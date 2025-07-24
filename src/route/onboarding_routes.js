import express from "express";
import { onboardDeviceDetails,configDevicesInDnac,dnacDeviceInterfaces, getUnClaimedDevice, getDnacSites, saveClaimSiteData, postPnPDeviceSiteClaim, allDnacDetails, sendMailForScreenShot, getPnpDevices, getFloorValue, getTemplatesByFloor, getDeviceDetails, getAllLocations, getDevicesByLocation, getDeviceInfo} from "../controller/Onboarding.js";
// import { authenticate, authorizeRoles} from '../../auth.js';
// import { dnacDataDetail, insertDeviceInDnac, onboardDeviceDetails } from "../controller/Onboarding_Portal/Onboarding.js";
import { configurationDetails, configureDevice, configureDeviceInISE, deployDefaultGateway, deviceDetails, getDeviceBySerialOrIP, getDeviceStatus, getPnpClaimedDevices, getRadiusConfiguration, getSiteClaimAndPnpTemplateBySourceUrl, networkDevice, pingDevice, pnpDatafromDB, tacacsAndRadiusConf} from "../controller/afterOnboardingController.js";


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

router.get('/getDeviceBySerialOrIP',getDeviceBySerialOrIP );







// router.post('/postPnPDeviceSiteClaim',postPnPDeviceSiteClaim);




export default router