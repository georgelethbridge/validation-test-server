import express from 'express';
import fetch from 'node-fetch';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// EPO OPS: Get applicants
app.get('/epo-applicants', async (req, res) => {
  const patentNumber = req.query.epNumber;

  try {
    const tokenResponse = await fetch('https://ops.epo.org/3.2/auth/accesstoken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${process.env.CLIENT_KEY}:${process.env.CLIENT_SECRET}`).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const endpointUrl = `https://ops.epo.org/3.2/rest-services/register/publication/epodoc/${patentNumber}/biblio.json`;

    const dataResponse = await fetch(endpointUrl, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });

    const data = await dataResponse.json();
    res.json(data);

  } catch (error) {
    console.error('Error fetching EPO applicants:', error);
    res.status(500).json({ error: 'Failed to fetch applicant data' });
  }
});

// Scrape GB Owners from UK IPO
app.get('/scrape-gb-owner/:epNumber', async (req, res) => {
  const epNumber = req.params.epNumber;
  const patentUrl = `https://www.search-for-intellectual-property.service.gov.uk/${epNumber}`;

  try {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new'
    });

    const page = await browser.newPage();
    await page.goto(patentUrl, { waitUntil: 'domcontentloaded' });

    const tableExists = await page.$('#patentApplicantsOwnersTable');
    if (!tableExists) {
      await browser.close();
      return res.status(404).json({ error: 'Owners table not found' });
    }

    const owners = await page.$$eval('#patentApplicantsOwnersTable tbody tr', rows =>
      rows.map(row => {
        const cells = row.querySelectorAll('td');
        return {
          name: cells[0]?.innerText.trim() || '',
          address: cells[1]?.innerText.trim() || ''
        };
      })
    );

    await browser.close();
    res.json({ owners });

  } catch (error) {
    console.error('Error scraping GB Owner info:', error);
    res.status(500).json({ error: 'Failed to scrape GB Owner info' });
  }
});

// Root route
app.get('/', (req, res) => {
  res.send('GB Scraper server is running 🚀');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
