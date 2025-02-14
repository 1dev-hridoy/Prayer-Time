const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const moment = require('moment-timezone');

const app = express();
const port = process.env.PORT || 3001;

// Serve static files from public directory
app.use(express.static('public', {
    extensions: ['html'], // This will automatically serve .html files without the extension
}));
app.use('/assets', express.static('assets'));

// Redirect /pagename.html to /pagename
app.use((req, res, next) => {
    if (req.path.endsWith('.html')) {
        const withoutHtml = req.path.slice(0, -5); // Remove .html
        return res.redirect(301, withoutHtml);
    }
    next();
});

// Route handlers
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/surah', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/surah.html'));
});

// API endpoints
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

// Add this route with your other routes
app.get('/tasbeeh', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/tasbeeh.html'));
});

// Add this route with your other routes
app.get('/resources', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/resources.html'));
});

// Add these new API endpoints after your existing endpoints

// Prayer Times by City
app.get('/api/prayer-times/:city/:country', async (req, res) => {
    try {
        const { city, country } = req.params;
        const today = moment().tz('Asia/Dhaka').format('DD-MM-YYYY');
        
        const response = await fetch(
            `https://api.aladhan.com/v1/timingsByCity/${today}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=2`
        );
        
        if (!response.ok) throw new Error('Prayer times service unavailable');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Prayer Times by Coordinates
app.get('/api/prayer-times/coordinates/:latitude/:longitude', async (req, res) => {
    try {
        const { latitude, longitude } = req.params;
        const today = moment().tz('Asia/Dhaka').format('DD-MM-YYYY');
        
        const response = await fetch(
            `https://api.aladhan.com/v1/timings/${today}?latitude=${latitude}&longitude=${longitude}&method=2`
        );
        
        if (!response.ok) throw new Error('Prayer times service unavailable');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Hijri Calendar Conversion (Gregorian to Hijri)
app.get('/api/calendar/gregorian/:date', async (req, res) => {
    try {
        const { date } = req.params;
        // Parse the date in the correct format (DD-MM-YYYY)
        const momentDate = moment(date, 'DD-MM-YYYY', true);
        
        if (!momentDate.isValid()) {
            throw new Error('Invalid date format. Please use DD-MM-YYYY');
        }
        
        const formattedDate = momentDate.format('DD-MM-YYYY');
        const response = await fetch(`http://api.aladhan.com/v1/gToH?date=${formattedDate}`);
        
        if (!response.ok) throw new Error('Calendar service unavailable');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to fetch Hijri date',
            message: error.message 
        });
    }
});

// Hijri Calendar Conversion (Hijri to Gregorian)
app.get('/api/calendar/hijri/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const response = await fetch(`http://api.aladhan.com/v1/hToG?date=${date}`);
        
        if (!response.ok) throw new Error('Calendar service unavailable');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ramadan Calendar
app.get('/api/ramadan-calendar/:year', async (req, res) => {
    try {
        const { year } = req.params;
        const response = await fetch(`http://api.aladhan.com/v1/hijriCalendarByYear/${year}?annual=false&month=9`);
        
        if (!response.ok) throw new Error('Ramadan calendar service unavailable');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ramadan Prayer Times
app.get('/api/ramadan-prayer-times/:year/:city/:country', async (req, res) => {
    try {
        const { year, city, country } = req.params;
        const response = await fetch(
            `http://api.aladhan.com/v1/hijriCalendarByCity/${year}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&annual=false&month=9`
        );
        
        if (!response.ok) throw new Error('Ramadan prayer times service unavailable');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Qibla Direction
app.get('/api/qibla/:latitude/:longitude', async (req, res) => {
    try {
        const { latitude, longitude } = req.params;
        const response = await fetch(
            `http://api.aladhan.com/v1/qibla/${latitude}/${longitude}`
        );
        
        if (!response.ok) throw new Error('Qibla direction service unavailable');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Islamic Calendar for a specific month
app.get('/api/hijri-calendar/:year/:month', async (req, res) => {
    try {
        const { year, month } = req.params;
        const response = await fetch(
            `http://api.aladhan.com/v1/hijriCalendar/${year}/${month}`
        );
        
        if (!response.ok) throw new Error('Islamic calendar service unavailable');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public/404.html'));
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