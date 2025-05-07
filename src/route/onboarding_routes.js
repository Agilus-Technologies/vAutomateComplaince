import express from "express";
import { onboardDeviceDetails,configDevicesInDnac,dnacDeviceInterfaces, getUnClaimedDevice, getDnacSites, saveClaimSiteData, postPnPDeviceSiteClaim, allDnacDetails} from "../controller/Onboarding.js";
// import { authenticate, authorizeRoles} from '../../auth.js';
// import { dnacDataDetail, insertDeviceInDnac, onboardDeviceDetails } from "../controller/Onboarding_Portal/Onboarding.js";


const router = express.Router();

// //insert device in dnac
// router.post('/insertDevice',insertDeviceInDnac);
router.post('/onboardDeviceDetails',onboardDeviceDetails);
router.post('/configDeviceInDnac',configDevicesInDnac);
router.post('/dnacDeviceInterface',dnacDeviceInterfaces);
router.post('/getUnClaimedDevice',getUnClaimedDevice);
router.post('/getDnacSites',getDnacSites);
router.post('/claimDevice',saveClaimSiteData);
router.get('/allDnacDetail',allDnacDetails);
// router.post('/postPnPDeviceSiteClaim',postPnPDeviceSiteClaim);




export default router