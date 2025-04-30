import express from 'express';
import fetch from 'node-fetch';
import cheerio from 'cheerio';
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

// UK IPO scraping via cheerio
app.get('/scrape-gb-owner/:epNumber', async (req, res) => {
  const epNumber = req.params.epNumber;
  const patentUrl = `https://www.search-for-intellectual-property.service.gov.uk/${epNumber}`;

  try {
    const response = await fetch(patentUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    const owners = [];

    $('#patentApplicantsOwnersTable tbody tr').each((i, row) => {
      const name = $(row).find('td').eq(0).text().trim();
      const address = $(row).find('td').eq(1).text().trim();
      if (name && address) {
        owners.push({ name, address });
      }
    });

    res.json({ owners });
  } catch (err) {
    console.error('Error scraping:', err);
    res.status(500).json({ error: 'Failed to scrape GB Owner info' });
  }
});

app.get('/', (req, res) => {
  res.send('Cheerio scraping server is live 🚀');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
