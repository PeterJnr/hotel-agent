import * as s from "../services/serviceRequest.service.js";
const err=(res,e)=>res.status(e.statusCode||400).json({success:false,message:e.message});
export async function create(req,res){try{return res.status(201).json({success:true,data:await s.createServiceRequest({...req.body,userId:req.user.id})});}catch(e){return err(res,e)}}
export async function mine(req,res){try{return res.json({success:true,data:await s.getMyServiceRequests(req.user.id)});}catch(e){return err(res,e)}}
export async function list(req,res){try{return res.json({success:true,data:await s.getServiceRequests(req.query)});}catch(e){return err(res,e)}}
export async function assignees(req,res){try{return res.json({success:true,data:await s.getServiceRequestAssignees()});}catch(e){return err(res,e)}}
export async function get(req,res){try{return res.json({success:true,data:await s.getServiceRequest({id:req.params.id,userId:req.user.id,userRoles:req.user.roles})});}catch(e){return err(res,e)}}
export async function assign(req,res){try{return res.json({success:true,data:await s.assignServiceRequest({id:req.params.id,assignedToId:req.body.assignedToId})});}catch(e){return err(res,e)}}
export async function status(req,res){try{return res.json({success:true,data:await s.updateServiceRequestStatus({id:req.params.id,status:req.body.status})});}catch(e){return err(res,e)}}
export async function priority(req,res){try{return res.json({success:true,data:await s.updateServiceRequestPriority({id:req.params.id,priority:req.body.priority})});}catch(e){return err(res,e)}}
export async function comment(req,res){try{return res.status(201).json({success:true,data:await s.addServiceRequestComment({id:req.params.id,authorId:req.user.id,userRoles:req.user.roles,content:req.body.content,isInternal:req.body.isInternal})});}catch(e){return err(res,e)}}
export async function cancel(req,res){try{return res.json({success:true,data:await s.cancelOwnServiceRequest({id:req.params.id,userId:req.user.id})});}catch(e){return err(res,e)}}
