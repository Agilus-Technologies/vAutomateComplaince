import express from "express"
import { configurationDetails, configureDeviceInISE, convertExcelToJSON, deviceDetails, networkDevice, pingDevice, pnpDatafromDB, tacacsAndRadiusConf} from "../controller/afterOnboardingController.js";



const router = express.Router();



router.get('/deviceDetails',deviceDetails);
router.post('/pingDevices',pingDevice);
router.post('/configurationData',configurationDetails);
// router.get('/test',networkDevice);
router.post('/tacacsAndRadiusConfs',tacacsAndRadiusConf);
router.get('/configureDeviceInISE',configureDeviceInISE);
router.get('/pnpDatafromDB',pnpDatafromDB);
router.get('/convertExcelToJSON',convertExcelToJSON);










export default router