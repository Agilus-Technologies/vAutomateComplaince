import logger from '../../logger.js';
// import onboardingModel from "../../model/onboardingModel.js"
import dbo from "../db/conn.js";
import { dnacResponse } from '../helper/dnacHelper.js';



export const deviceDetails = async (req, res) => {
    try {
        const db_connect = dbo && dbo.getDb();
        let setUpDetails = await db_connect.collection('ms_device').find({}).toArray();
        if (!setUpDetails || setUpDetails?.length == 0) {
            let errorMsg = { data: [], msg: "Unable to get dnac data.", status: false }
            logger.error(errorMsg)
            return res.send(errorMsg)
        }
        res.json({
            data: setUpDetails,
            msg: "Data get successfully",
            status: true
        })
    } catch (err) {
        let errorMsg = { data: [], msg: `Error msg in deviceDetails:${err}`, status: false }
        logger.error(errorMsg)
        console.log(errorMsg)
        return res.send(errorMsg)
    }
};





export const pingDevice = async (req, res) => {
    try {
        // var hosts = ['192.168.1.1', 'google.com', 'yahoo.com'];
        // for(let host of hosts){
        // let res = await ping.promise.probe(host);
        let { ip, device,dnacUrl } = req.body
        if (!ip || !device) {
            logger.error({ msg: "Unable to get ip from user", status: false })
            return res.send({ msg: "Unable to get ip from user", status: false })
        }
        let finalOutput = await dnacResponse(dnacUrl,device,ip)
        console.log("finalOutput",finalOutput)
        // let result = await ping.promise.probe(ip);
        // let msg = result?.alive
        // if (msg) {
        //     let resultMsg = { msg: "Gateway reachable from the current management IP", status: true }
        //     logger.info(resultMsg)
        //     return res.send(resultMsg)
        // } else {
        //     let resultMsg = { msg: "Gateway unreachable from the current management IP. Please verify connectivity.", status: false }
        //     logger.error(resultMsg)
        //     return res.send(resultMsg)
        // }

    } catch (err) {
        let resultMsg = { msg: `Error in pingDevice:${err}`, status: false }
        logger.error(resultMsg)
        return res.send(resultMsg)
    }

}