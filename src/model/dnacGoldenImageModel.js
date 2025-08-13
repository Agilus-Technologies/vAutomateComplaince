import { Schema, model } from "mongoose";

const dnacGoldenImageSchema = new Schema({
  dnacUrl: { type: String, required: true },
  imageId: { type: String, required: true },
  name: { type: String },
  family: { type: String },
  version: { type: String },
  displayVersion: { type: String },
  md5Checksum: { type: String },
  shaCheckSum: { type: String },
  createdTime: { type: String },
  imageType: { type: String },
  fileSize: { type: String },
  imageName: { type: String },
  applicationType: { type: String },
  feature: { type: String },
  fileServiceId: { type: String },
  isTaggedGolden: { type: Boolean },
  imageSource: { type: String },
  vendor: { type: String },
  imageIntegrityStatus: { type: String },
  extendedAttributes: { type: Object },
  applicableDevicesForImage: { type: Array },
  importSourceType: { type: String },
  ccoreverseSync: { type: Boolean },
  imageData: { type: Object, required: true },
  syncedAt: { type: Date, default: Date.now }
}, { timestamps: true, versionKey: false });

const dnacGoldenImageModel = model("dnacgoldenimages", dnacGoldenImageSchema);

export default dnacGoldenImageModel;
