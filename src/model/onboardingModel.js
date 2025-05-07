import { Schema, model } from "mongoose";

const onboardingSchame = new Schema({

    "region": {
        type: String,
        required: true
    },
    "site": {
        type: String,
        required: true,
    },
    "floor": {
        type: String,
        required: true,
    },
    "accessDevice": {
        type: String,
        required: true,
    },
    "ipAddress": {
        type: String,
        required: true,
        // default: true
    },
    "serialNumber": {
        type: String,
        required: true,
    },
    // New fields added
    "pnpVlan": {
        type: Number,
        default: 0
    },
    "pnpStar": {
        type: String,
        default: '',
    },
    "uplinkInterface": {
        type: String,
        required: true,
    },
    "interface": {
        type: String,
         default: '',
    },
    "vlanId": {
        type: Number,
         default:0,
    },
    "uniqueName": {
        type: String,
         required: true,
    },
    "serialNumber": {
        type: String,
         required: true,
    },
    config:{
        type: String,
        required: true,
    },
    "otherParameters": {
        type: String,
         default:"",
    },

}, { timestamps: true, versionKey: false })

const onboardingModel = model("onboardingdata", onboardingSchame);

export default onboardingModel

