import logger from '../../logger.js';
// import onboardingModel from "../../model/onboardingModel.js"
import dbo from "../db/conn.js";
import { dnacResponse } from '../helper/dnacHelper.js';
import https from "https";
import axios from "axios";
import { execute_templates } from '../helper/dnacHelper.js';
import { commonCredentials } from '../helper/dnacHelper.js';
import base64 from "base-64";
import xlsx from "xlsx";
import fs from "fs"
import path from "path"

// const base64 = require('base-64');



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
        console.log("details", details, "details")
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
            console.log("The device is successfully configured and accessible.")
            logger.error({ msg: `The device is successfully configured and accessible`, status: false })
            let msg = { msg: `The device is successfully configured and accessible`, status: false }
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
        let dnacData = {
            config: config,
            dnac: data?.dnacUrl,
            device: data?.device
        }
        let excuteConfigInDnac = await execute_templates(dnacData)
        let msgs = {};

        if (excuteConfigInDnac == "SUCCESS") {
            msgs = { msg: "Device configured successfully.", status: true }
            let validateResponse = await validateDataFromDnac(data?.dnacUrl, data?.device)
            console.log(validateResponse)
            logger.info(validateResponse)
            return res.json(validateResponse)
        } else {
            msgs = { msg: "Unable to configured device.", status: false }
            return res.json(msgs)
        }

    } catch (err) {
        console.log("Error in tacacsAndRadiusConf", err)
        logger.error({ msg: `Error in tacacsAndRadiusConf: ${err}`, status: false })
        let msgError = { msg: `Error in tacacsAndRadiusConf: ${err.message}`, status: false }
        return res.send(msgError)
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

export const convertExcelToJSON = async (req, res) => {
    try {
        const db_connect = dbo && dbo.getDb();
        const __dirname = path.resolve()
        const filePath = path.join(__dirname, 'test.xlsx');
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames;
        let outputData = {}
        for (let i = 0; i < sheetName.length; i++) {
            const worksheet = workbook.Sheets[sheetName[i]];
            let jsonData = xlsx.utils.sheet_to_json(worksheet);
            outputData[`${sheetName[i]}`] = jsonData
        }
        if (Object.keys(outputData).length !== 0) {
            let savePNPData = await db_connect.collection('ms_pnp_data').insertOne(outputData)
            console.log('Excel converted to JSON successfully!');
            return;
        } else {
            console.log("UNable to read data from excel in pnp")
            return;
        }
    } catch (err) {
        console.log("error in convertExcelToJSON", err)
        return;
    }
}

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

// convertExcelToJSON()

