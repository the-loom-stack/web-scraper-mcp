'use strict';

const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');
const scrapeController = require('../controllers/scrape.controller');
const rapidApiAuth = require('../middleware/rapidapi.auth');

// Health is auth-exempt
router.get('/health', healthController.getHealth);

// Protected routes
router.post('/scrape', rapidApiAuth, scrapeController.scrapeUrl);
router.post('/scrape/batch', rapidApiAuth, scrapeController.scrapeUrls);
router.post('/crawl', rapidApiAuth, scrapeController.crawlSite);
router.get('/run/:runId', rapidApiAuth, scrapeController.getRunStatus);
router.get('/dataset/:datasetId', rapidApiAuth, scrapeController.getDatasetItems);

module.exports = router;
