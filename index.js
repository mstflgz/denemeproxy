const express = require('express');
const axios = require('axios');
const https = require('https'); // SSL ayarı için eklendi
const app = express();
const port = process.env.PORT || 3000;

const TARGET_HEADERS = {
    'Referer': 'https://taraftarium.xyz/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0'
};

// Geçersiz SSL sertifikalarını görmezden gelmek için ajan oluşturuyoruz
const agent = new https.Agent({  
    rejectUnauthorized: false
});

app.get('/stream', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).send('URL parametresi eksik.');
    }

    try {
        const response = await axios({
            method: 'GET',
            url: targetUrl,
            headers: TARGET_HEADERS,
            httpsAgent: agent, // SSL korumasını devre dışı bıraktık
            responseType: 'arraybuffer'
        });

        const contentType = response.headers['content-type'] || '';
        res.set('Content-Type', contentType);
        res.set('Access-Control-Allow-Origin', '*');

        if (contentType.includes('mpegurl') || targetUrl.includes('.m3u8')) {
            let m3u8Content = Buffer.from(response.data).toString('utf8');
            let lines = m3u8Content.split('\n');
            
            const targetUrlObj = new URL(targetUrl);
            const targetBase = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
            
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i].trim();
                if (line && !line.startsWith('#')) {
                    let absoluteUrl = line;
                    if (!line.startsWith('http')) {
                        absoluteUrl = line.startsWith('/') ? targetUrlObj.origin + line : targetBase + line;
                    }
                    const proxyUrl = `${req.protocol}://${req.get('host')}/stream?url=${encodeURIComponent(absoluteUrl)}`;
                    lines[i] = proxyUrl;
                }
            }
            return res.send(lines.join('\n'));
        } 
        
        res.send(response.data);

    } catch (error) {
        // Hatayı Render loglarında daha detaylı görebilmek için güncelledik
        const status = error.response ? error.response.status : 'Bilinmiyor';
        const msg = error.message;
        console.error(`Proxy Hatası -> Durum Kodu: ${status}, Detay: ${msg}`);
        res.status(500).send(`Sunucuya bağlanılamadı. Hata: ${msg}`);
    }
});

app.listen(port, () => {
    console.log(`Proxy yayında. Port: ${port}`);
});
