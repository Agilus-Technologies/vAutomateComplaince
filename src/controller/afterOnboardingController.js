import logger from '../../logger.js';
// import onboardingModel from "../../model/onboardingModel.js"
import dbo from "../db/conn.js";
import { dnacResponse } from '../helper/dnacHelper.js';
import https from "https";
import axios from "axios";
import { execute_templates } from '../helper/dnacHelper.js';



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

export const networkDevice = async (device) => {
    try {
        const db_connect = dbo && dbo.getDb();
        let setUpDetails = await db_connect.collection('tbl_Package').find({}).project({ "ise": 1, "_id": 0 }).toArray();
        if (setUpDetails.length == 0 || Object.keys(setUpDetails[0]?.ise) == 0) {
            return { msg: "Unable to get ISE credential", status: true }
        }

        const { iseURL, iseURLName, iseURLPassword } = setUpDetails[0]?.ise
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://${iseURL}/ers/config/networkdevice`,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                Authorization:
                    "Basic " +
                    Buffer.from(
                        iseURLName + ":" + iseURLPassword
                    ).toString("base64"),
            },
            httpsAgent: httpsAgent
        };
        // await new Promise(resolve => setTimeout(resolve, 2000));
        const response = await axios.request(config);
        if (Object.keys(response).length == 0 || Object.keys(response?.data).length == 0 || Object.keys(response?.data?.SearchResult).length == 0 || response?.data?.SearchResult?.resources?.length == 0) {
            return { data: [], msg: "Unable to get network device from ISE", status: false }
        }
        let networkDeviceOutput = response?.data?.SearchResult?.resources
        networkDeviceOutput = networkDeviceOutput.map(item => ({
            ...item, 
            created: new Date(),
            updatedAt:new Date
        }));
        let matchIp = networkDeviceOutput.filter((items) => { return items.name == device })
        //  output.push({ ...item, ...response2?.data?.NetworkDevice, createdAt: new Date(), updatedAt: new Date() })
        // let findData = await await db_connect.collection('ms_iseinventory').find({}).toArray()
        // if (findData.length > 0) {
        //     let deleteNetworkDevice = await db_connect.collection('ms_iseinventory').deleteMany({});
        //     let saveNetworkDevice = await db_connect.collection('ms_iseinventory').insertMany(networkDeviceOutput);
        // } else {
        //     let saveNetworkDevice = await db_connect.collection('ms_iseinventory').insertMany(networkDeviceOutput);
        // }
        if (matchIp) {
            return { data: [], msg: `Device ${device} is avaliable in ISE`, status: true }
        } else {
            return { data: [], msg: `Device ${device} is not avaliable in ISE`, status: false }
        }

        // for (let item of networkDeviceOutput) {
        //     config["url"] = item.link.href;
        //     // let config2 = {
        //     //     method: 'get',
        //     //     maxBodyLength: Infinity,
        //     //     url: item.link.href,
        //     //     headers: {
        //     //         'Content-Type': 'application/json',
        //     //         'Accept': 'application/json',
        //     //         Authorization:
        //     //             "Basic " +
        //     //             Buffer.from(
        //     //                 iseURLName + ":" + iseURLPassword
        //     //             ).toString("base64"),
        //     //     },
        //     //     httpsAgent: httpsAgent
        //     // };
        //     const response2 = await axios.request(config);
        //     // const response2 = await axios.request(config2);
        //     if (Object.keys(response2).length == 0 || Object.keys(response2.data).length == 0 || Object.keys(response2.data.NetworkDevice).length == 0) {
        //         logger.error({ msg: `${item?.link?.href} not working.`, status: false })
        //         console.log({ msg: `${item?.link?.href} not working.`, status: false })
        //         output.push({ ...item, msg: `${item?.link?.href} not working.`, createdAt: new Date(), updatedAt: new Date() })
        //     } else {
        //         output.push({ ...item, ...response2?.data?.NetworkDevice, createdAt: new Date(), updatedAt: new Date() })
        //     }
        // }
    } catch (err) {
        let msgOutput = { fileId: "", msg: `Error in taskResponse:${err.message || err}`, status: false }
        console.log("error in taskurl", err)
        return msgOutput
    }
};

export const configurationDetails = async (req, res) => {
    try {
        let data = req.body
        console.log("data", req.body)
        const db_connect = dbo && dbo.getDb();
        if (!db_connect) {
            return res.send({ msg: "Unable to connect to database.", status: false })
        }
        if (!data || Object.keys(data).length == 0 || data.interfaceLevel.length == 0) {
            return res.send({ msg: "Unable to get data from user.", status: false })
        }
        const { interfaceLevel } = data;
        let interfaceConfig = ""
        interfaceLevel.forEach((item) => {
            if (item?.port_description?.toLowerCase() == "voice") {
                interfaceConfig += `interface ${item?.interface}\ndescription ${item?.port_description}\nswitchport mode access\nswitchport voice vlan ${item?.voice_vlan}\nno shutdown\n`
            } else if (item?.port_description?.toLowerCase() == "voice+data") {
                interfaceConfig += `interface ${item?.interface}\ndescription ${item?.port_description}\nswitchport mode access\nswitchport access vlan ${item?.access_vlan}\nswitchport voice vlan ${item?.voice_vlan}\nno shutdown\n`
            } else {
                interfaceConfig += `interface ${item?.interface}\ndescription ${item?.port_description}\nswitchport mode access\nswitchport access vlan ${item?.access_vlan}\nno shutdown\n`
            }
        });
        if (!interfaceConfig) {
            return res.json({ msg: "Unable to make interface configuration", status: false })
        }
        interfaceConfig = interfaceConfig.slice(0, -1)
        console.log("interfaceConfig", interfaceConfig)
        let dnacData = {
            config: interfaceConfig,
            dnac: data?.dnacUrl,
            device: data?.device,
        }
        let excuteConfigInDnac = await execute_templates(dnacData)
        let msgs = {};
        if (excuteConfigInDnac == "SUCCESS") {
            msgs = { msg: "Device configured successfully.", status: true }
        } else {
            msgs = { msg: "Unable to configured device.", status: false }
            return res.json(msgs)
        }
        let details = { ...data, config: interfaceConfig, createdAt: new Date(), updatedAt: new Date() }
        console.log("details", details)
        let saveData = await db_connect.collection('ms_interfaceConfig').insertOne(details);

        // check device exist in ISE or not
        let iseNetworkDevice = await networkDevice(data?.device)
        return res.send(iseNetworkDevice)
    } catch (err) {
        console.log(`Error in configuration:${err}`)
        logger.error({ msg: `Error in configurationDetails:${err}`, status: false })
        let msgError = { msg: `Error in configurationDetails:${err.message}`, status: false }
        return res.send(msgError)
    }

};




// export const networkDevice = async (req, res) => {
//     try {
//         const db_connect = dbo && dbo.getDb();
//         let setUpDetails = await db_connect.collection('tbl_Package').find({}).project({ "ise": 1, "_id": 0 }).toArray();
//         if (setUpDetails.length == 0 || Object.keys(setUpDetails[0]?.ise) == 0) {
//             return { msg: "Unable to get ISE credential", status: true }
//         }

//         const { iseURL, iseURLName, iseURLPassword } = setUpDetails[0]?.ise
//         const httpsAgent = new https.Agent({
//             rejectUnauthorized: false
//         });
//         let config = {
//             method: 'get',
//             maxBodyLength: Infinity,
//             url: `https://${iseURL}/ers/config/networkdevice`,
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Accept': 'application/json',
//                 Authorization:
//                     "Basic " +
//                     Buffer.from(
//                         iseURLName + ":" + iseURLPassword
//                     ).toString("base64"),
//             },
//             httpsAgent: httpsAgent
//         };
//         // await new Promise(resolve => setTimeout(resolve, 2000));
//         const response = await axios.request(config);
//         if (Object.keys(response).length == 0 || Object.keys(response?.data).length == 0 || Object.keys(response?.data?.SearchResult).length == 0 || response?.data?.SearchResult?.resources?.length == 0) {
//             return { data: [], msg: "Unable to get network device from ISE", status: false }
//         }
//         let networkDeviceOutput = response?.data?.SearchResult?.resources
//         let output = []
//         for (let item of networkDeviceOutput) {
//             config["url"] = item.link.href;
//             // let config2 = {
//             //     method: 'get',
//             //     maxBodyLength: Infinity,
//             //     url: item.link.href,
//             //     headers: {
//             //         'Content-Type': 'application/json',
//             //         'Accept': 'application/json',
//             //         Authorization:
//             //             "Basic " +
//             //             Buffer.from(
//             //                 iseURLName + ":" + iseURLPassword
//             //             ).toString("base64"),
//             //     },
//             //     httpsAgent: httpsAgent
//             // };
//             const response2 = await axios.request(config);
//             // const response2 = await axios.request(config2);
//             if (Object.keys(response2).length == 0 || Object.keys(response2.data).length == 0 || Object.keys(response2.data.NetworkDevice).length == 0) {
//                 logger.error({ msg: `${item?.link?.href} not working.`, status: false })
//                 console.log({ msg: `${item?.link?.href} not working.`, status: false })
//                 output.push({ ...item, msg: `${item?.link?.href} not working.`, createdAt: new Date(), updatedAt: new Date() })
//             } else {
//                 output.push({ ...item, ...response2?.data?.NetworkDevice, createdAt: new Date(), updatedAt: new Date() })
//             }
//             console.log(response2, "response2")
//         }
//         let saveNetworkDevice = await db_connect.collection('vautomate_networkDevice').insertMany(output);

//         return { msg: "Network fevice get successfully.", status: true }
//     } catch (err) {
//         let msgOutput = { fileId: "", msg: `Error in taskResponse:${err.message || err}`, status: false }
//         console.log("error in taskurl", err)
//         return msgOutput
//     }
// }
