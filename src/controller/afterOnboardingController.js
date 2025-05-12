import logger from '../../logger.js';
// import onboardingModel from "../../model/onboardingModel.js"
import dbo from "../db/conn.js";
import { dnacResponse } from '../helper/dnacHelper.js';



export const deviceDetails = async (req, res) => {
    try {
        const db_connect = dbo && dbo.getDb();
        let setUpDetails = await db_connect.collection('ms_device').find({ "source": "DNAC" }).toArray();
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
        let { ip, device, dnacUrl } = req.body
        if (!ip || !device || !dnacUrl) {
            logger.error({ msg: "Unable to get ip,device or dnac url ", status: false })
            console.log({ msg: "Unable to get ip,device or dnac url ", status: false })
            return res.send({ msg: "Unable to get ip,device or dnac url ", status: false })
        }
        let finalOutput = await dnacResponse(dnacUrl, device, ip)
        if (!finalOutput.status) {
            // if (Object.keys(finalOutput).length == 0 || !finalOutput.status) {
            logger.error(finalOutput)
            console.log(finalOutput)
            return res.send(finalOutput)
        }
        let pingStatus = finalOutput?.data?.includes("Success rate is 100 percent (5/5)")
        if (pingStatus) {
            let resultMsg = { msg: "Gateway reachable from the current management IP", status: true }
            console.log(resultMsg)
            logger.info(resultMsg)
            return res.send(resultMsg)
        } else {
            let resultMsg = { msg: "Gateway unreachable from the current management IP. Please verify connectivity.", status: true }
            console.log(resultMsg)
            logger.info(resultMsg)
            return res.send(resultMsg)
        }

    } catch (err) {
        let resultMsg = { msg: `Error in pingDevice:${err}`, status: false }
        logger.error(resultMsg)
        return res.send(resultMsg)
    }

};
const config={
 voice:`interface GigabitEthernet1/0/8\nswitchport access vlan 122\nswitchport mode access\nswitchport voice vlan 180\nno shutdown`,
 data:`interface gigabitEthernet 1/0/5\ndescription "X"/nswitchport mode trunk\nswitchport trunk allowed vlan 123\nno shutdown`
}



export const configurationDetails = async (req, res) => {
    try {
        console.log("data", req.body)
        let data = req.body
        if (!data || Object.keys(data).length == 0 || data.interfaceLevel.length == 0) {
            return res.send({ msg: "Unable to get data from user.", status: false })
        }
        const { interfaceLevel } = data;
       let output = interfaceLevel.map((item)=>{
            return item
        })
        console.log(output,"conf")
        // interfaceLevel.forEach((item) => {
        //     console.log(item)
        // })

        return res.send({ msg: "Data get successfully", status: true })

    } catch (err) {
        console.log(`Error in configuration:${err}`)
        logger.error({ msg: `Error in configurationDetails:${err}`, status: false })
        let msgError = { msg: `Error in configurationDetails:${err.message}`, status: false }
        return res.send(msgError)
    }

}
