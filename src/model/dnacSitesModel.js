import { Schema, model } from "mongoose";

const dnacSiteSchema = new Schema({
  dnacUrl: { type: String, required: true },
  siteId: { type: String, required: true },
  name: { type: String },
  parentId: { type: String },
  instanceTenantId: { type: String },
  siteHierarchy: { type: String },
  siteNameHierarchy: { type: String },
  additionalInfo: { type: Array },
  siteData: { type: Object, required: true },
  syncedAt: { type: Date, default: Date.now }
}, { timestamps: true, versionKey: false });

const dnacSitesModel = model("dnacsites", dnacSiteSchema);

export default dnacSitesModel;
