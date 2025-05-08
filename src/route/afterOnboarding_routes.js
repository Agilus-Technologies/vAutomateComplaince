import express from "express"
import { configurationDetails, deviceDetails, pingDevice } from "../controller/afterOnboardingController.js";


const router = express.Router();



router.get('/deviceDetails',deviceDetails);
router.post('/pingDevices',pingDevice);
router.post('/configurationData',configurationDetails);









export default router