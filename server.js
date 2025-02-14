const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const moment = require('moment-timezone');

const app = express();
const port = process.env.PORT || 3001;

app.use(express.static('public'));
app.use('/assets', express.static('assets'));

function convertToBengaliNumerals(time) {
    const [inputHours, inputMinutes] = time.split(':').map(Number);
    
    const bdTime = moment().tz('Asia/Dhaka')
        .hours(inputHours)
        .minutes(inputMinutes);
    
    let hours = bdTime.format('h');
    const minutes = bdTime.format('mm');
    const period = bdTime.format('A');
    
    const periodInBengali = period === 'AM' ? 'এএম' : 'পিএম';
    
    const bengaliNumerals = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    const bengaliTime = `${hours.split('').map(d => bengaliNumerals[d]).join('')}:${minutes.split('').map(d => bengaliNumerals[d]).join('')} ${periodInBengali}`;
    
    return bengaliTime;
}

app.get('/api/prayer-times', async (req, res) => {
    try {
        let city = 'Dhaka';
        let country = 'Bangladesh';

        try {
            const locationResponse = await fetch('https://api.ipbase.com/v1/json/');
            if (locationResponse.ok) {
                const locationData = await locationResponse.json();
                if (locationData && locationData.city && locationData.country_name) {
                    city = locationData.city;
                    country = locationData.country_name;
                }
            }
        } catch (error) {
            console.log('Using default location (Dhaka, Bangladesh)');
        }
        
        const today = moment().tz('Asia/Dhaka').format('DD-MM-YYYY');
        
        const prayerResponse = await fetch(
            `https://api.aladhan.com/v1/timingsByCity/${today}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=2`
        );
        
        if (!prayerResponse.ok) {
            throw new Error('Prayer times service unavailable');
        }
        
        const prayerData = await prayerResponse.json();
        
        const response = {
            timings: {
                Fajr: convertToBengaliNumerals(prayerData.data.timings.Fajr),
                Dhuhr: convertToBengaliNumerals(prayerData.data.timings.Dhuhr),
                Asr: convertToBengaliNumerals(prayerData.data.timings.Asr),
                Maghrib: convertToBengaliNumerals(prayerData.data.timings.Maghrib),
                Isha: convertToBengaliNumerals(prayerData.data.timings.Isha)
            },
            date: prayerData.data.date,
            meta: prayerData.data.meta,
            location: {
                city,
                country
            }
        };
        
        res.json(response);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch prayer times',
            message: error.message 
        });
    }
});

// Quran Chapters API
app.get('/api/chapters', async (req, res) => {
    try {
        const response = await fetch('https://api.quran.com/api/v4/chapters');
        if (!response.ok) {
            throw new Error('Failed to fetch chapters');
        }
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            error: 'Failed to fetch chapters',
            message: error.message
        });
    }
});

// Chapter Info API
app.get('/api/chapters/:id/info', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await fetch(`https://api.quran.com/api/v4/chapters/${id}/info`);
        if (!response.ok) {
            throw new Error('Failed to fetch chapter info');
        }
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            error: 'Failed to fetch chapter info',
            message: error.message
        });
    }
});

app.get('/surah', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/surah.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} is busy. Trying port ${port + 1}`);
        app.listen(port + 1);
    } else {
        console.error('Server error:', err);
    }
});