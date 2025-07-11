import express from "express"
import { configurationDetails, configureDevice, configureDeviceInISE, deviceDetails, getRadiusConfiguration, getSiteClaimAndPnpTemplateBySourceUrl, networkDevice, pingDevice, pnpDatafromDB, tacacsAndRadiusConf} from "../controller/afterOnboardingController.js";



const router = express.Router();



router.get('/deviceDetails',deviceDetails);
router.post('/pingDevices',pingDevice);
router.post('/configurationData',configurationDetails);
// router.get('/test',networkDevice);
router.post('/tacacsAndRadiusConfs',tacacsAndRadiusConf);
router.post("/configure-device", configureDevice);
router.get('/configureDeviceInISE',configureDeviceInISE);
router.get('/pnpDatafromDB',pnpDatafromDB);
// router.get('/convertExcelToJSON',convertExcelToJSON);
router.get('/getLatestSiteClaimBySourceUrl',getSiteClaimAndPnpTemplateBySourceUrl);
router.get('/radius-config',getRadiusConfiguration);


export default router