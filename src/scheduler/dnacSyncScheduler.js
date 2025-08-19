import cron from 'node-cron';

import { getDnacSites } from '../helper/dnacHelper.js';
import dnacSitesModel from '../model/dnacSitesModel.js';
import dnacGoldenImageModel from '../model/dnacGoldenImageModel.js';
import logger from '../../logger.js';
import { getImageID } from '../controller/Onboarding.js';
import dbo from "../db/conn.js";
import { set } from 'mongoose';


/**
 * Run DNAC sync job (can be called from API or cron)
 */
export async function syncDnacSites(dnacUrl) {
  const db_connect = dbo && dbo.getDb();

  const sitesResp = await getDnacSites(dnacUrl);
  logger.info({ msg: 'DNAC syncDnacSites: getDnacSites API call successful', dnacUrl, status: !!sitesResp });
  const sites = sitesResp?.response || [];
  let savedSiteCount = 0;
  for (const site of sites) {
    await dnacSitesModel.findOneAndUpdate(
      { dnacUrl, id: site.id },
      {
        dnacUrl,
        id: site.id,
        name: site.name,
        parentId: site.parentId,
        instanceTenantId: site.instanceTenantId,
        siteHierarchy: site.siteHierarchy,
        siteNameHierarchy: site.siteNameHierarchy,
        additionalInfo: site.additionalInfo,
        syncedAt: new Date()
      },
      { upsert: true }
    );
    savedSiteCount++;
  }
  logger.info(`[${dnacUrl}] Saved ${savedSiteCount} sites`);
  return savedSiteCount;
}

export async function syncDnacGoldenImages(dnacUrl) {
  const goldenImagesResp = await getImageID(dnacUrl);
  logger.info({ msg: 'DNAC syncDnacGoldenImages: getImageID API call successful', dnacUrl, status: !!goldenImagesResp });
  const goldenImages = goldenImagesResp?.response || [];
  let savedImageCount = 0;
  for (const img of goldenImages) {
    await dnacGoldenImageModel.findOneAndUpdate(
      { dnacUrl, imageId: img.imageUuid || img.id },
      {
        dnacUrl,
        imageId: img.imageUuid || img.id,
        name: img.name,
        family: img.family,
        version: img.version,
        displayVersion: img.displayVersion,
        imageType: img.imageType,
        fileSize: img.fileSize,
        imageName: img.imageName,
        applicationType: img.applicationType,
        feature: img.feature,
        fileServiceId: img.fileServiceId,
        isTaggedGolden: img.isTaggedGolden,
        imageSource: img.imageSource,
        vendor: img.vendor,
        imageIntegrityStatus: img.imageIntegrityStatus,
        applicableDevicesForImage: img.applicableDevicesForImage,
        importSourceType: img.importSourceType,
        extendedAttributes: img.extendedAttributes,
        syncedAt: new Date()
      },
      { upsert: true }
    );
    savedImageCount++;
  }
  logger.info(`[${dnacUrl}] Saved ${savedImageCount} golden images`);
  return savedImageCount;
}

export async function runDnacSyncJob() {
  logger.info('DNAC sync job started');
  try {
    const db_connect = dbo && dbo.getDb();
    
    const dnacData = await db_connect.collection('tbl_Package').find({ dnac: { $exists: true, $ne: [] } }).toArray();
    for (const doc of dnacData) {
      if (!doc.dnac || !Array.isArray(doc.dnac)) continue;
      for (const dnac of doc.dnac) {
        try {
          const dnacUrl = dnac.DnacURL;
          await syncDnacSites(dnacUrl);
          await syncDnacGoldenImages(dnacUrl);
        } catch (err) {
          logger.error(`Failed to sync for DNAC ${dnac.DnacURL}:`, err);
        }
      }
    }
  } catch (err) {
    logger.error('Error in DNAC sync job:', err);
    throw err;
  }
}
// setTimeout(() => {
//   logger.info('Starting DNAC sync job immediately');
//   runDnacSyncJob().catch(err => logger.error('Error running DNAC sync job:', err));
// }, 1000); // Start immediately after server starts

// Cron schedule (still runs daily at 10:00 AM IST)
cron.schedule('0 10 * * *', runDnacSyncJob, { timezone: 'Asia/Kolkata' });
