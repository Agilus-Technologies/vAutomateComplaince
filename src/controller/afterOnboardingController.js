import logger from '../../logger.js';
// import onboardingModel from "../../model/onboardingModel.js"
import dbo from "../db/conn.js";
import { dnacResponse } from '../helper/dnacHelper.js';
import https from "https";
import axios from "axios";
import { execute_templates } from '../helper/dnacHelper.js';
import { commonCredentials } from '../helper/dnacHelper.js';
import base64 from "base-64";
import * as xlsx from 'xlsx';
// import xlsx from "xlsx";
import fs from "fs"
import path from "path"

// const base64 = require('base-64');



// export const deviceDetails = async (req, res) => {
//     try {
//         const db_connect = dbo && dbo.getDb();
//         let setUpDetails = await db_connect.collection('ms_device').find({ "source": "DNAC" }).toArray();
//         if (!setUpDetails || setUpDetails?.length == 0) {
//             let errorMsg = { data: [], msg: "Unable to get dnac data.", status: false }
//             logger.error(errorMsg)
//             return res.send(errorMsg)
//         }
//         res.json({
//             data: setUpDetails,
//             msg: "Data get successfully",
//             status: true
//         })
//     } catch (err) {
//         let errorMsg = { data: [], msg: `Error msg in deviceDetails:${err}`, status: false }
//         logger.error(errorMsg)
//         console.log(errorMsg)
//         return res.send(errorMsg)
//     }
// };

export const deviceDetails = async (req, res) => {
    try {
        const db_connect = dbo && dbo.getDb();

        let claimedDevices = await db_connect
            .collection("onboardingdata")
            .find({ pnpClaim: true })
            .toArray();

        claimedDevices.forEach(device => {
            device.source_url = device.dnac || "";
            device.managementIpAddress = device.device || "";
            device.serial_number = device.serialNo || "";
        });

        return res.json({
            msg: "Claimed devices fetched successfully.",
            status: true,
            data: claimedDevices
        });
    } catch (err) {
        const errorMsg = { msg: `Error in getClaimedDevices: ${err}`, status: false };
        logger.error(errorMsg);
        console.log(errorMsg);
        return res.status(500).json(errorMsg);
    }
};


export const getSiteClaimAndPnpTemplateBySourceUrl = async (req, res) => {
    try {
        const db_connect = dbo.getDb(); // get your db connection
        const source_url = req.query.source_url;

        if (!source_url) {
            return res.status(400).json({ error: "Missing source_url in query" });
        }

        // Step 1: Get the latest record from siteclaimdata by dnacUrl
        const siteClaimCollection = db_connect.collection("siteclaimdata");
        const latestSiteClaim = await siteClaimCollection
            .find({ dnacUrl: source_url })
            .sort({ createdAt: -1 })
            .limit(1)
            .toArray();

        if (!latestSiteClaim.length) {
            return res.status(404).json({ message: "No siteclaimdata found for source_url" });
        }

        const siteClaim = latestSiteClaim[0];
        const snmpLocation = siteClaim.snmpLocation;

        if (!snmpLocation) {
            return res.status(404).json({ message: "SNMP location not found in siteclaimdata" });
        }

        // Step 2: Find a match in ms_pnp_data collection inside PNP_Template_DAY_N array
        const pnpCollection = db_connect.collection("ms_pnp_data");

        const matchedRecord = await pnpCollection.findOne({
            "PNP_Template_DAY_N.snmp_location": snmpLocation,
        });

        if (!matchedRecord) {
            return res.status(404).json({ message: "No PNP Template found for SNMP location" });
        }

        // Optionally extract only the matching template entry from array:
        const matchingTemplate = matchedRecord.PNP_Template_DAY_N.find(
            (entry) => entry.snmp_location === snmpLocation
        );

        return res.status(200).json({
            //   siteClaim,
            matchedPNPTemplate: matchingTemplate || null,
        });
    } catch (err) {
        console.error("Error:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};



export const pingDevice = async (req, res) => {
    try {
        // let { ip, device, dnacUrl } = req.body
        let { device, dnacUrl } = req.body;
       let ip = device?.split(" ")[0]; // Extract IP from device string
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
            updatedAt: new Date
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

const generateInterfaceConfig = (interfaceLevel) => {
    let interfaceConfig = "";

    interfaceLevel.forEach((item) => {
        const intf = item?.interface;
        const descRaw = item?.port_description || "";
        const desc = descRaw.toLowerCase();
        const accessVlan = item?.access_vlan || "X";
        const voiceVlan = item?.voice_vlan || "X";

        interfaceConfig += `interface ${intf}\n`;
        interfaceConfig += `description ${descRaw}\n`;

        if (desc.includes("USER DATA & VOICE PORT")) {
            interfaceConfig += `
switchport access vlan ${accessVlan}
switchport mode access
switchport voice vlan ${voiceVlan}
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();

        } else if (desc.includes("user data")) {
            interfaceConfig += `
switchport access vlan ${accessVlan}
switchport mode access
switchport voice vlan ${voiceVlan}
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();

        } else if (desc.includes("Stagging")) {
            interfaceConfig += `
switchport access vlan ${accessVlan}
switchport mode access
switchport nonegotiate
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();

        } else if (desc.includes("Printer")) {
            interfaceConfig += `
switchport access vlan ${accessVlan}
switchport mode access
switchport nonegotiate
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();

        } else if (desc.includes("Voice")) {
            interfaceConfig += `
switchport mode access
switchport voice vlan ${voiceVlan}
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();

        } else if (desc.includes("CCTV")) {
            interfaceConfig += `
switchport access vlan ${accessVlan}
switchport mode access
switchport nonegotiate
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();

        } else if (desc.includes("ACT")) {
            interfaceConfig += `
switchport access vlan ${accessVlan}
switchport mode access
switchport nonegotiate
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();

        } else if (desc.includes("BMS")) {
            interfaceConfig += `
switchport access vlan ${accessVlan}
switchport mode access
switchport nonegotiate
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();

        } else if (desc.includes("CMS")) {
            interfaceConfig += `
switchport access vlan ${accessVlan}
switchport mode access
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();

        } else {
            // Default/fallback config if no keyword matched
            interfaceConfig += `
switchport access vlan ${accessVlan}
switchport mode access
device-tracking attach-policy ise-tracking
authentication event fail action next-method
authentication event server dead action authorize vlan ${accessVlan}
authentication event server dead action authorize voice
authentication event server alive action reinitialize
authentication host-mode multi-domain
authentication order mab dot1x
authentication priority dot1x mab
authentication port-control auto
authentication violation restrict
mab
dot1x pae authenticator
storm-control broadcast level 3.00
storm-control multicast level 3.00
spanning-tree portfast
spanning-tree bpduguard enable
storm-control action trap
no shutdown
`.trim();
        }

        interfaceConfig += `\n\n`; // gap between interface blocks
    });

    return interfaceConfig.trim();
};


export const configurationDetails = async (req, res) => {
    try {
        let data = req.body
        console.log("data", req.body)
        // const db_connect = dbo && dbo.getDb();
        if (!db_connect) {
            return res.send({ msg: "Unable to connect to database.", status: false })
        }
        if (!data || Object.keys(data).length == 0 || data.interfaceLevel.length == 0) {
            return res.send({ msg: "Unable to get data from user.", status: false })
        }
        const { interfaceLevel } = data;
        let interfaceConfig = ""
        // interfaceLevel.forEach((item) => {
        //     if (item?.port_description?.toLowerCase() == "voice") {
        //         interfaceConfig += `interface ${item?.interface}\ndescription ${item?.port_description}\nswitchport mode access\nswitchport voice vlan ${item?.voice_vlan}\nno shutdown\n`
        //     } else if (item?.port_description?.toLowerCase() == "voice+data") {
        //         interfaceConfig += `interface ${item?.interface}\ndescription ${item?.port_description}\nswitchport mode access\nswitchport access vlan ${item?.access_vlan}\nswitchport voice vlan ${item?.voice_vlan}\nno shutdown\n`
        //     } else {
        //         interfaceConfig += `interface ${item?.interface}\ndescription ${item?.port_description}\nswitchport mode access\nswitchport access vlan ${item?.access_vlan}\nno shutdown\n`
        //     }
        // });
        // interfaceLevel.forEach((item) => {
        //     const intf = item?.interface;
        //     const rawDesc = item?.port_description || '';
        //     const desc = rawDesc.toLowerCase();
        //     const accessVlan = item?.access_vlan;
        //     const voiceVlan = item?.voice_vlan;

        //     interfaceConfig += `interface ${intf}\n`;
        //     interfaceConfig += `description "${rawDesc}"\n`;
        //     interfaceConfig += `switchport mode access\n`;

        //     if (desc.includes("voice") && desc.includes("data")) {
        //         // Voice + Data
        //         interfaceConfig += `switchport access vlan ${accessVlan}\n`;
        //         interfaceConfig += `switchport voice vlan ${voiceVlan}\n`;

        //     } else if (desc.includes("voice")) {
        //         // Voice Only
        //         interfaceConfig += `switchport voice vlan ${voiceVlan}\n`;

        //     } else {
        //         // Data or CCTV
        //         interfaceConfig += `switchport access vlan ${accessVlan}\n`;
        //     }

        //     // Common authentication block for all ports now
        //     interfaceConfig += `authentication event fail retry 2 action next-method\n`;
        //     interfaceConfig += `authentication event server dead action authorize vlan ${accessVlan}\n`;
        //     interfaceConfig += `authentication event server dead action authorize voice\n`;
        //     interfaceConfig += `authentication event server alive action reinitialize\n`;
        //     interfaceConfig += `authentication host-mode multi-domain\n`;
        //     interfaceConfig += `authentication order mab dot1x\n`;
        //     interfaceConfig += `authentication priority dot1x mab\n`;
        //     interfaceConfig += `authentication port-control auto\n`;
        //     interfaceConfig += `authentication violation restrict\n`;
        //     interfaceConfig += `mab\n`;
        //     interfaceConfig += `device-tracking attach-policy ise-tracking\n`;
        //     interfaceConfig += `dot1x pae authenticator\n`;
        //     interfaceConfig += `authentication open\n`;
        //     interfaceConfig += `ip device tracking maximum 10\n`;
        //     interfaceConfig += `no shutdown\n\n`;
        // });
        const configOutput = generateInterfaceConfig(req.body.interfaceLevel);
        console.log(configOutput); // final interface config




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
        }
        let details = { ...data, config: interfaceConfig, createdAt: new Date(), updatedAt: new Date() }
        console.log("details", details, "details")
        let saveData = await db_connect.collection('ms_interfaceConfig').insertOne(details);
        return res.json(msgs)

        // check device exist in ISE or not
        // let iseNetworkDevice = await networkDevice(data?.device)
        // return res.send(iseNetworkDevice)
    } catch (err) {
        console.log(`Error in configuration:${err}`)
        logger.error({ msg: `Error in configurationDetails:${err}`, status: false })
        let msgError = { msg: `Error in configurationDetails:${err.message}`, status: false }
        return res.send(msgError)
    }

};

export const validateDataFromDnac = async (dnacUrl, device) => {
    try {
        let commanCredential = await commonCredentials(device, dnacUrl)
        const { token } = commanCredential
        if (token == "") {
            logger.error({ msg: `Device is configured successfully but unable to get token in validData`, status: false })
            let msgError = { msg: `Device is configured successfully but unable to get token in validData`, status: false }
            return msgError
        }
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `${dnacUrl}/dna/intent/api/v1/network-device?managementIpAddress=${device}`,
            headers: {
                'x-auth-token': token
            },
            httpsAgent: httpsAgent
        };
        let result = await axios.request(config)
        if (result && result.status == 200) {
            // console.log("The device is successfully configured and accessible.")
            logger.error({ msg: `The device is successfully configured and accessible`, status: true })
            let msg = { msg: `The device is successfully configured and accessible`, status: true }
            return msg
        } else {
            console.log("The device is successfully configured but not accessible.", result)
            logger.error({ msg: `The device is successfully configured but not accessible:${result}`, status: false })
            let msg = { msg: `The device is successfully configured but not accessible`, status: false }
            return msg
        }

    } catch (err) {
        console.log("Error in validateDataFromDnac", err)
        logger.error({ msg: `Error in validateDataFromDnac:${err.message}`, status: false })
        let msgError = { msg: `Error in validateDataFromDnac:${err.message}`, status: false }
        return msgError
    }
};


export const tacacsAndRadiusConf = async (req, res) => {
    try {

        let data = req.body
        if (data && data?.registrationData.length == 0) {
            console.log(`Unable to get data from user.`)
            logger.error({ msg: `Unable to get data from user.`, status: false })
            let msgError = { msg: `Unable to get data from user.`, status: false }
            return res.send(msgError)
        }
        if (data && data?.device == "") {
            console.log(`Please select device.`)
            logger.error({ msg: `Please select device.`, status: false })
            let msgError = { msg: `Please select device.`, status: false }
            return res.send(msgError)
        }

        let commonConfig = `aaa authentication login default group Network local\naaa authentication enable default group Network enable none\naaa authentication dot1x default group ISE\naaa authorization console\naaa authorization config-commands\naaa authorization exec default group Network local if-authenticated\naaa authorization commands 0 default group Network local if-authenticated\naaa authorization commands 1 default group Network local if-authenticated\naaa authorization commands 15 default group Network local if-authenticated\naaa authorization network default group ISE\naaa accounting send stop-record authentication failure\naaa accounting dot1x default start-stop group ISE\naaa accounting exec default start-stop group Network\naaa accounting commands 0 default start-stop group Network\naaa accounting commands 1 default start-stop group Network\naaa accounting commands 15 default start-stop group Network\naaa accounting network default start-stop group tacacs+\naaa accounting connection default start-stop group Network\naaa accounting system default start-stop group Network\naaa session-id common`
        let tacacsStatic1 = `aaa group server tacacs+ Network`
        let radiusStatic = `aaa new-model\naaa group server radius ISE`
        let config = "";
        let radiusServerData = data?.registrationData.filter((item) => { return item.type === "radiusServer" })
        let tacacsServerData = data?.registrationData.filter((item) => { return item.type === "TACACS" })
        if (radiusServerData.length == 0 && tacacsServerData.length == 0) {
            console.log(`Unable to get data from user.`)
            logger.error({ msg: `Unable to get data from user.`, status: false })
            let msgError = { msg: `Unable to get data from user.`, status: false }
            return res.send(msgError)
        };

        //********************radius server configuration***************************
        if (radiusServerData && radiusServerData.length > 0) {
            for (let i = 0; i < radiusServerData.length; i++) {
                const { radiusName: name, iseServerIP: ip, key } = radiusServerData[i]
                radiusStatic += `\n server name ${name}`
            }
            radiusStatic += `\naaa server radius dynamic-author`

            for (let i = 0; i < radiusServerData.length; i++) {
                const { radiusName: name, iseServerIP: ip, key } = radiusServerData[i]
                radiusStatic += `\n client ${ip} server-key 7 ${key}`

            }
            radiusStatic += "\nradius-server attribute 6 on-for-login-auth\nradius-server attribute 8 include-in-access-req\nradius-server attribute 25 access-request include\nradius-server dead-criteria time 5 tries 2\nradius-server deadtime 10"
            for (let i = 0; i < radiusServerData.length; i++) {
                const { radiusName: name, iseServerIP: ip, key } = radiusServerData[i]
                radiusStatic += `\nradius server ${name}\n address ipv4 ${ip} auth-port 1812 acct-port 1813\n key 7 ${key}`
            }
            config += radiusStatic
        };

        //*****************Tacacs configuration*************************
        if (tacacsServerData && tacacsServerData.length > 0) {
            for (let i = 0; i < tacacsServerData.length; i++) {
                const { radiusName: name, iseServerIP: ip, key } = tacacsServerData[i]
                tacacsStatic1 += `\n server-private ${ip} key 7 ${key} `
            }
            if (config) {
                config += `\n${tacacsStatic1}\n`
            } else {
                config += `${tacacsStatic1}\n`
            }
        }

        config += commonConfig

        console.log("config2", config)
        let Data = {
            config: config,
            dnac: data?.dnacUrl,
            device: data?.device
        }
        return res.json({ msg: "configured Created successfully.", status: true, Data }
        )
        // let dnacData = {
        //     config: config,
        //     dnac: data?.dnacUrl,
        //     device: data?.device
        // }
        // let excuteConfigInDnac = await execute_templates(dnacData)
        // let msgs = {};

        // if (excuteConfigInDnac == "SUCCESS") {
        //     msgs = { msg: "Device configured successfully.", status: true }
        //     let validateResponse = await validateDataFromDnac(data?.dnacUrl, data?.device)
        //     console.log(validateResponse)
        //     logger.info(validateResponse)
        //     return res.json(validateResponse)
        // } else {
        //     msgs = { msg: "Unable to configured device.", status: false }
        //     return res.json(msgs)
        // }

    } catch (err) {
        console.log("Error in tacacsAndRadiusConf", err)
        logger.error({ msg: `Error in tacacsAndRadiusConf: ${err}`, status: false })
        let msgError = { msg: `Error in tacacsAndRadiusConf: ${err.message}`, status: false }
        return res.send(msgError)
    }
};



/**
 * @desc Configure a device via DNAC and validate the result
 * @route POST /api/configure-device
 */
export const configureDevice = async (req, res) => {
    try {
        const { config, dnac, device } = req.body.commandData;

        if (!config || !dnac || !device) {
            return res.status(400).json({
                status: false,
                msg: "Missing required fields: config, dnac, or device."
            });
        }

        const dnacData = { config, dnac: dnac, device };
        const executeResult = await execute_templates(dnacData);

        if (executeResult === "SUCCESS") {
            const validateResponse = await validateDataFromDnac(dnac, device);
            logger?.info(validateResponse); // Optional logging
            return res.json(validateResponse);
        } else {
            return res.json({
                status: false,
                msg: "Unable to configure device."
            });
        }

    } catch (error) {
        console.error("DNAC Configuration Error:", error);
        return res.status(500).json({
            status: false,
            msg: "Internal Server Error",
            error: error.message
        });
    }
};


export const configureDeviceInISE = async (req, res) => {
    try {
        const db_connect = dbo && dbo.getDb();
        let setUpDetails = await db_connect.collection('tbl_Package').find({}).project({ "ise": 1, "_id": 0 }).toArray();
        if (setUpDetails.length == 0 || Object.keys(setUpDetails[0]?.ise) == 0) {
            return { msg: "Unable to get ISE credential", status: true }
        }

        const { iseURL, iseURLName, iseURLPassword } = setUpDetails[0]?.ise
        const iseHost = `https://${iseURL}/ers/config/networkdevice`;
        // const iseHost = `https://${iseURL}:9060`;
        // Base64 encode the username:password for Basic Auth
        // const auth = base64.encode(`${iseURLName}:${iseURLPassword}`);
        //*************body******************* */
        const deviceData = {
            "NetworkDevice": {
                "name": "Test",
                "description": "Testing",
                "authenticationSettings": {
                    "radiusSharedSecret": "aaaaa",
                    "enableKeyWrap": true,
                    "dtlsRequired": true,
                    "keyEncryptionKey": "1234567890123456",
                    "messageAuthenticatorCodeKey": "12345678901234567890",
                    "keyInputFormat": "ASCII"
                },
                "snmpsettings": {
                    "version": "ONE",
                    "roCommunity": "aaa",
                    "pollingInterval": 3600,
                    "linkTrapQuery": true,
                    "macTrapQuery": true,
                    "originatingPolicyServicesNode": "Auto"
                },
                "trustsecsettings": {
                    "deviceAuthenticationSettings": {
                        "sgaDeviceId": "networkDevice1",
                        "sgaDevicePassword": "aaaaa"
                    },
                    "sgaNotificationAndUpdates": {
                        "downlaodEnvironmentDataEveryXSeconds": 86400,
                        "downlaodPeerAuthorizationPolicyEveryXSeconds": 86400,
                        "reAuthenticationEveryXSeconds": 86400,
                        "downloadSGACLListsEveryXSeconds": 86400,
                        "otherSGADevicesToTrustThisDevice": false,
                        "sendConfigurationToDevice": false,
                        "sendConfigurationToDeviceUsing": "ENABLE_USING_COA",
                        "coaSourceHost": "IseNodeName"
                    },
                    "deviceConfigurationDeployment": {
                        "includeWhenDeployingSGTUpdates": true,
                        "enableModePassword": "aaaaa",
                        "execModePassword": "aaaaa",
                        "execModeUsername": "aaa"
                    },
                    "pushIdSupport": "false"
                },
                "tacacsSettings": {
                    "sharedSecret": "aaaaa",
                    "connectModeOptions": "ON_LEGACY"
                },
                "profileName": "Cisco",
                "coaPort": 1700,
                "dtlsDnsName": "ISE213.il.com",
                "NetworkDeviceIPList": [
                    {
                        "ipaddress": "10.1.122.2",
                        "mask": 32
                    }
                ],
                "NetworkDeviceGroupList": [
                    "Location#All Locations",
                    "Device Type#All Device Types"
                ]
            }
        };

        // const deviceData = {
        //     NetworkDevice: {
        //         name: "Test-01",
        //         description: "Testing",
        //         ipAddresses: [
        //             {
        //                 ipaddress: "10.122.1.2",
        //                 mask: 32
        //             }
        //         ],
        //         authenticationSettings: {
        //             radiusSharedSecret: "MySecret123",
        //             radiusServerDefined: false
        //         },
        //         snmpSettings: {
        //             version: "ONE",
        //             roCommunity: "public",
        //             retries: 2,
        //             timeout: 5,
        //             pollInterval: 1000
        //         },
        //         coaPort: 1700,
        //         // dtlsRequired: false
        //     }
        // };


        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });
        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: iseHost,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                // 'ERS-Media-Type': 'network.device.1.0',
                Authorization:
                    "Basic " +
                    Buffer.from(
                        iseURLName + ":" + iseURLPassword
                    ).toString("base64"),
            },
            data: JSON.stringify(deviceData),
            // NetworkDevice: deviceData.NetworkDevice,
            httpsAgent: httpsAgent,
        };

        // await new Promise(resolve => setTimeout(resolve, 2000));
        const response = await axios.request(config);
        console.log("response", response)

        // axios.post(`${iseHost}`, deviceData, {
        //     headers: {
        //         'Content-Type': 'application/json',
        //         'Accept': 'application/json',
        //         'ERS-Media-Type': 'network.device.1.0',
        //         'Authorization': `Basic ${auth}`
        //     },
        //     httpsAgent: httpsAgent
        // })
        //     .then(response => {
        //         console.log('Network device created successfully:', response.data);
        //     })
        //     .catch(error => {
        //         console.error('Error creating network device:', error.response?.data || error.message);
        //     });

    } catch (err) {
        console.log("error in configureDeviceInISE", err)
    }
}


function normalizeKeys(row) {
    const normalized = {};
    for (const key in row) {
        const newKey = key.toLowerCase().replace(/\s+/g, '_');
        normalized[newKey] = row[key];
    }
    return normalized;
}

export const convertExcelToJSON = async (req, res) => {
    try {
        const db_connect = dbo && dbo.getDb();
        const __dirname = path.resolve();
        const filePath = path.join(__dirname, 'Assignment_Group.xlsx');
        const workbook = xlsx.readFile(filePath);
        const sheetNames = workbook.SheetNames;

        let outputData = {};

        for (let i = 0; i < sheetNames.length - 1; i++) {
            const sheet = workbook.Sheets[sheetNames[0]];
            let jsonData = xlsx.utils.sheet_to_json(sheet, { defval: null });

            jsonData = jsonData.map(row => {
                row = normalizeKeys(row);
                return {
                    ...row,
                    mgmt_subnet: row['mgmt_subnet'] ?? '10.138.132.128/25',
                    reserved_seed_ports: row['reserved_seed_ports'] ?? 'Need to Reserve Two ports one from primary and one from secondary'
                };
            });

            outputData[sheetNames[i]] = jsonData;
        }

        if (Object.keys(outputData).length !== 0) {
            let savePNPData = await db_connect.collection('ms_pnp_data').insertOne(outputData);
            console.log('Excel converted to JSON and saved to MongoDB!');
            return res.status(200).json({ message: "Data inserted successfully" });
        } else {
            console.log("Unable to read data from Excel in PNP");
            return res.status(400).json({ message: "No data found in Excel" });
        }

    } catch (err) {
        console.log("Error in convertExcelToJSON:", err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};



export const pnpDatafromDB = async (req, res) => {
    try {
        const db_connect = dbo && dbo.getDb();
        let getPNPData = await db_connect.collection('ms_pnp_data').find({}).sort({ _id: -1 }).limit(2).toArray();
        if (getPNPData.length == 0) {
            console.log("Unbale to get pnp data from db")
            logger.error({ msg: `"Unbale to get pnp data from db"`, status: fasle })
            let msg = { msg: `"Unbale to get pnp data from db"`, status: false }
            return res.send(msg)
        }
        res.json({ data: getPNPData[0], status: true })

    } catch (err) {
        console.log("Error in pnpDatafromDB.", err)
        logger.error({ msg: `Error in pnpDatafromDB:${err}`, status: fasle })
        let msg = { outputData, msg: `Error in pnpDatafromDB:${err.message}`, status: false }
        return res.send(msg)
    }
}



// export const convertExcelToJSON2 = async (req, res) => {
//     try {
//         const db_connect = dbo && dbo.getDb();
//         const __dirname = path.resolve();
//         const filePath = path.join(__dirname, 'PE_Devices_Day0 1.xlsx');

//         const workbook = xlsx.readFile(filePath);
//         const sheetNames = workbook.SheetNames;
        
//         let outputData = {};
        
//         for (let i = 0; i < sheetNames.length; i++) {
//             const sheet = workbook.Sheets[sheetNames[i]];
//             let jsonData = xlsx.utils.sheet_to_json(sheet, { defval: null });
            
//             jsonData = jsonData.map(row => {
//                 row = normalizeKeys2(row);
//                 return {
//                     ...row,
//                     // mgmt_subnet: row['mgmt_subnet'] ?? '10.138.132.128/25',
//                     // reserved_seed_ports: row['reserved_seed_ports'] ?? 'Need to Reserve Two ports one from primary and one from secondary'
//                 };
//             });
            
//             outputData[sheetNames[i]] = jsonData;
//         }
        
//         if (Object.keys(outputData).length !== 0) {
//             const result =  await db_connect.collection('ms_pnp_data').insertOne(outputData);
//             console.log('✅ Excel converted and single document inserted into MongoDB.');
//             return res.status(200).json({ success: true, message: "Data inserted as single document", insertedId: result.insertedId });
//         } else {
//             console.log("⚠️ No data found in Excel");
//             return res.status(400).json({ success: false, message: "No data found in Excel" });
//         }
        
//     } catch (err) {
//         console.error("❌ Error in convertExcelToJSON:", err);
//         return res.status(500).json({ success: false, message: 'Internal Server Error' });
//     }
// };

// function normalizeKeys2(row) {
//     const normalized = {};
//     Object.keys(row).forEach(key => {
//         const cleanKey = key.trim().replace(/\s+/g, '_').toLowerCase();
//         normalized[cleanKey] = row[key];
//     });
//     return normalized;
// }


export const getRadiusConfiguration = async (req, res) => {
    try {
        const radiusConfig = [
            // "ARUBA WAP PORT",
            // "Cisco WAP",
            "USER DATA & VOICE PORT",
            "USER DATA PORT",
            "Stagging Area PORT",
            "Printer Port",
            "Voice PORT",
            "CCTV Port",
            "ACT Port",
            "BMS Port",
            "CMS Port"
        ];

        return res.status(200).json({
            success: true,
            configType: "Radius Configuration",
            ports: radiusConfig
        });

    } catch (error) {
        console.error("Error in getRadiusConfiguration:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

