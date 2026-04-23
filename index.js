const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Zorunlu başlıklarımız
const TARGET_HEADERS = {
    'Referer': 'https://taraftarium.xyz/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0'
};

app.get('/stream', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).send('URL parametresi eksik.');
    }

    try {
        // Hedef sunucudan dosyayı (m3u8 veya ts) başlıklarla birlikte çekiyoruz
        const response = await axios({
            method: 'GET',
            url: targetUrl,
            headers: TARGET_HEADERS,
            responseType: 'arraybuffer' // TS dosyalarının bozulmaması için binary olarak alıyoruz
        });

        const contentType = response.headers['content-type'] || '';
        res.set('Content-Type', contentType);
        res.set('Access-Control-Allow-Origin', '*');

        // Eğer gelen dosya bir M3U8 listesi ise, içindeki linkleri bizim proxy'e yönlendirecek şekilde değiştiriyoruz
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
                    // Oynatıcı alt linki çekerken yine bizim Render uygulamamıza gelsin
                    const proxyUrl = `${req.protocol}://${req.get('host')}/stream?url=${encodeURIComponent(absoluteUrl)}`;
                    lines[i] = proxyUrl;
                }
            }
            return res.send(lines.join('\n'));
        } 
        
        // Eğer dosya TS (video parçası) ise doğrudan Televizo'ya gönderiyoruz
        res.send(response.data);

    } catch (error) {
        console.error("Proxy Hatası:", error.message);
        res.status(500).send('Sunucuya bağlanılamadı.');
    }
});

app.listen(port, () => {
    console.log(`Proxy yayında. Port: ${port}`);
});