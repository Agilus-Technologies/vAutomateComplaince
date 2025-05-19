import express from "express"
import { configurationDetails, deviceDetails, networkDevice, pingDevice } from "../controller/afterOnboardingController.js";
// import { commonCredentials } from "../helper/dnacHelper.js";


const router = express.Router();



router.get('/deviceDetails',deviceDetails);
router.post('/pingDevices',pingDevice);
router.post('/configurationData',configurationDetails);
router.get('/test',networkDevice);
// router.post('/test',commonCredentials);









export default router