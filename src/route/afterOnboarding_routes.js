import express from "express"
import { deviceDetails, pingDevice } from "../controller/afterOnboardingController.js";


const router = express.Router();



router.get('/deviceDetails',deviceDetails);
router.post('/pingDevices',pingDevice);









export default router