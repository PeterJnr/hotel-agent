import * as service from "../services/emailTemplate.service.js";
const error = (res, e) => res.status(e.statusCode || 400).json({ success: false, message: e.message });
export async function create(req, res) { try { return res.status(201).json({ success: true, data: await service.createEmailTemplate({ data: req.body, userId: req.user.id }) }); } catch (e) { return error(res, e); } }
export async function list(req, res) { try { return res.json({ success: true, data: await service.listEmailTemplates(req.query) }); } catch (e) { return error(res, e); } }
export async function get(req, res) { try { return res.json({ success: true, data: await service.getEmailTemplate(req.params.id) }); } catch (e) { return error(res, e); } }
export async function update(req, res) { try { return res.json({ success: true, data: await service.updateEmailTemplate({ id: req.params.id, data: req.body, userId: req.user.id }) }); } catch (e) { return error(res, e); } }
export async function activate(req, res) { try { return res.json({ success: true, data: await service.activateEmailTemplate({ id: req.params.id, userId: req.user.id }) }); } catch (e) { return error(res, e); } }
export async function deactivate(req, res) { try { return res.json({ success: true, data: await service.deactivateEmailTemplate({ id: req.params.id, userId: req.user.id }) }); } catch (e) { return error(res, e); } }
export async function remove(req, res) { try { await service.deleteEmailTemplate(req.params.id); return res.json({ success: true, message: "Email template deleted." }); } catch (e) { return error(res, e); } }
export async function preview(req, res) { try { return res.json({ success: true, data: await service.previewEmailTemplate(req.params.id, req.body.variables) }); } catch (e) { return error(res, e); } }
export function placeholders(req, res) { return res.json({ success: true, data: service.templatePlaceholders }); }
