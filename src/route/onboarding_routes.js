import express from "express";
import { onboardDeviceDetails,configDevicesInDnac,dnacDeviceInterfaces, getUnClaimedDevice, getDnacSites, saveClaimSiteData, postPnPDeviceSiteClaim, allDnacDetails, sendMailForScreenShot, getPnpDevices, getFloorValue, getTemplatesByFloor, getDeviceDetails, getAllLocations, getDevicesByLocation, getDeviceInfo} from "../controller/Onboarding.js";
// import { authenticate, authorizeRoles} from '../../auth.js';
// import { dnacDataDetail, insertDeviceInDnac, onboardDeviceDetails } from "../controller/Onboarding_Portal/Onboarding.js";
import { checkIPGatewayStatus, configurationDetails, configureDevice, configureDeviceInISE, configureVtpmode, deleteDayNConfigById, deleteDeviceById, deployDefaultGateway, deviceDetails, getAllDayNConfigs, getAllDevices, getCommandOutput, getDayNStatus, getDeviceBySerial, getDeviceStatus, getGoldenImage, getPnpClaimedDevices, getRadiusConfiguration, getSiteClaimAndPnpTemplateBySourceUrl, networkDevice, pingDevice, pnpDatafromDB, runDnacSyncJobCont, syncDevicesWithDnac, syncDnacGoldenImage, syncDnacSite, tacacsAndRadiusConf, updateDayNConfigById, updateDeviceById, updateDeviceMgmtAddress, updateMgmtIpAddress} from "../controller/afterOnboardingController.js";
import { run_show_command_on_device } from "../helper/dnacHelper.js";
import { runDnacSyncJob, syncDnacGoldenImages, syncDnacSites } from "../scheduler/dnacSyncScheduler.js";


const router = express.Router();
// ******************** Device onboarding (PnP) ***********************

// //insert device in dnac
// router.post('/insertDevice',insertDeviceInDnac);
router.post('/screenshot',sendMailForScreenShot);
router.post('/onboardDeviceDetails',onboardDeviceDetails);
router.post('/configDeviceInDnac',configDevicesInDnac);
router.post('/dnacDeviceInterface',dnacDeviceInterfaces);
router.post('/getUnClaimedDevice',getUnClaimedDevice);
router.post('/getDnacSites',getDnacSites);
router.post('/claimDevice',saveClaimSiteData);
router.get('/allDnacDetail',allDnacDetails);
router.get('/getPnpDevices', getPnpDevices);
router.get('/getFloorList',getFloorValue)
router.get('/getTemplatesByFloor',getTemplatesByFloor);
router.get('/getDeviceDetails',getDeviceDetails);
router.get('/locations',getAllLocations);
router.get('/devicesByLocation',getDevicesByLocation);
router.get('/device-details',getDeviceInfo);


// **************** Reachability, config push *******************************


router.get('/deviceDetails',deviceDetails);
router.post('/pingDevices',pingDevice);
router.post('/configurationData',configurationDetails);
// router.get('/test',networkDevice);
router.post('/tacacsAndRadiusConfs',tacacsAndRadiusConf);
router.post("/configure-device", configureDevice);
router.get('/configureDeviceInISE',configureDeviceInISE);
router.get('/pnpDatafromDB',pnpDatafromDB);
// router.get('/convertExcelToJSON',insertExcelRowsAsDocuments);
router.get('/getLatestSiteClaimBySourceUrl',getSiteClaimAndPnpTemplateBySourceUrl);
router.get('/radius-config',getRadiusConfiguration);
router.post('/deployGateway', deployDefaultGateway);
router.get('/getPnpClaimedDevices',getPnpClaimedDevices );
router.get('/device-status',getDeviceStatus );

router.get('/getDeviceBySerial',getDeviceBySerial );


router.post('/getCommandOutput', getCommandOutput);

router.get('/getGoldenImage', getGoldenImage)



// GET all devices
router.get('/pe-devices', getAllDevices);

// PUT to edit a device by ID
router.put('/pe-devices/:id', updateDeviceById);

// DELETE a device by ID
router.delete('/pe-devices/:id', deleteDeviceById);


router.get('/dayn-configs', getAllDayNConfigs);
router.put('/dayn-configs/:id', updateDayNConfigById);
router.delete('/dayn-configs/:id', deleteDayNConfigById);


router.post('/configureVtpmode', configureVtpmode);


router.post('/updateMgmtIpAddress', updateDeviceMgmtAddress);


router.get('/syncDnacSites', syncDnacSite);


router.get('/syncDnacGoldenImages', syncDnacGoldenImage);

router.get('/runDnacSyncJob', runDnacSyncJobCont);

router.post('/checkIPGatewayStatus',checkIPGatewayStatus)


router.post('/getDayNStatus',getDayNStatus)




// router.post('/syncDevicesWithDnac', syncDevicesWithDnac);

// router.post('/updateDeviceMgmtAddress', updateDeviceMgmtAddress);








// router.post('/postPnPDeviceSiteClaim',postPnPDeviceSiteClaim);




export default router