'use strict';

const { validateUrl, validateUrls, validateApifyId } = require('../utils/validators');
const { formatItems } = require('../utils/formatItems');
const apifyService = require('../services/apify.service');
const { startTimer } = require('../utils/timer');

async function scrapeUrl(req, res, next) {
  try {
    const timer = startTimer();
    const url = validateUrl(req.body.url);
    const outputFormat = req.body.outputFormat || 'markdown';

    const items = await apifyService.scrapeUrls([url], {
      outputFormat,
      crawlerType: req.body.crawlerType,
      maxCrawlDepth: 0,
      maxCrawlPages: 1
    });

    const pages = formatItems(items, outputFormat);

    res.json({
      success: true,
      data: {
        url,
        totalPages: pages.length,
        pages
      },
      meta: {
        processingTimeMs: timer.elapsed(),
        requestId: req.requestId
      }
    });
  } catch (error) {
    next(error);
  }
}

async function scrapeUrls(req, res, next) {
  try {
    const timer = startTimer();
    const urls = validateUrls(req.body.urls);
    const outputFormat = req.body.outputFormat || 'markdown';

    const items = await apifyService.scrapeUrls(urls, {
      outputFormat,
      crawlerType: req.body.crawlerType,
      maxCrawlDepth: 0,
      maxCrawlPages: urls.length
    });

    const pages = formatItems(items, outputFormat);

    res.json({
      success: true,
      data: {
        totalPages: pages.length,
        pages
      },
      meta: {
        processingTimeMs: timer.elapsed(),
        requestId: req.requestId
      }
    });
  } catch (error) {
    next(error);
  }
}

async function crawlSite(req, res, next) {
  try {
    const timer = startTimer();
    const url = validateUrl(req.body.url);
    const outputFormat = req.body.outputFormat || 'markdown';

    const items = await apifyService.scrapeUrls([url], {
      outputFormat,
      crawlerType: req.body.crawlerType,
      maxCrawlDepth: req.body.maxCrawlDepth != null ? req.body.maxCrawlDepth : 1,
      maxCrawlPages: req.body.maxCrawlPages || 10
    });

    const pages = formatItems(items, outputFormat);

    res.json({
      success: true,
      data: {
        startUrl: url,
        totalPages: pages.length,
        pages
      },
      meta: {
        processingTimeMs: timer.elapsed(),
        requestId: req.requestId
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getRunStatus(req, res, next) {
  try {
    const timer = startTimer();
    const runId = validateApifyId(req.params.runId, 'runId');
    const run = await apifyService.getRunStatus(runId);

    res.json({
      success: true,
      data: {
        id: run.id,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        defaultDatasetId: run.defaultDatasetId,
        usageTotalUsd: run.usageTotalUsd
      },
      meta: {
        processingTimeMs: timer.elapsed(),
        requestId: req.requestId
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getDatasetItems(req, res, next) {
  try {
    const timer = startTimer();
    const datasetId = validateApifyId(req.params.datasetId, 'datasetId');
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const outputFormat = req.query.outputFormat || 'markdown';

    const items = await apifyService.getDatasetItems(datasetId, { limit, offset });
    const pages = formatItems(items, outputFormat);

    res.json({
      success: true,
      data: {
        totalItems: pages.length,
        offset,
        limit,
        items: pages
      },
      meta: {
        processingTimeMs: timer.elapsed(),
        requestId: req.requestId
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { scrapeUrl, scrapeUrls, crawlSite, getRunStatus, getDatasetItems };
