import { prisma } from "../lib/prisma.js";
import { notifyServiceRequestAssigned, notifyServiceRequestCreated, notifyServiceRequestStatusChanged } from "./emailNotification.service.js";
const categories = new Set(["HOUSEKEEPING","MAINTENANCE","ROOM_SERVICE","COMPLAINT","OTHER"]);
const priorities = new Set(["LOW","MEDIUM","HIGH","URGENT"]);
const statuses = new Set(["OPEN","ASSIGNED","IN_PROGRESS","RESOLVED","CLOSED","CANCELLED"]);
const staffRoles = new Set(["SUPER_ADMIN","ADMIN","FRONT_DESK","SERVICE_MANAGER"]);
const transitions = { OPEN: ["ASSIGNED","IN_PROGRESS","CANCELLED"], ASSIGNED: ["IN_PROGRESS","OPEN","CANCELLED"], IN_PROGRESS: ["RESOLVED","CANCELLED"], RESOLVED: ["IN_PROGRESS","CLOSED"], CLOSED: [], CANCELLED: [] };
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const required = (v, name, max) => { if (typeof v !== "string" || !v.trim()) throw fail(`${name} is required.`); if (v.trim().length > max) throw fail(`${name} must not exceed ${max} characters.`); return v.trim(); };
const upper = (v) => typeof v === "string" ? v.trim().toUpperCase() : v;
const include = { user: { select: { id:true,firstName:true,lastName:true,email:true,phone:true } }, room:true, reservation:{select:{id:true,checkIn:true,checkOut:true,status:true}}, assignedTo:{select:{id:true,firstName:true,lastName:true,email:true}}, comments:{include:{author:{select:{id:true,firstName:true,lastName:true}}},orderBy:{createdAt:"asc"}} };
const isStaff = (roles=[]) => roles.some((r)=>staffRoles.has(r));

export async function createServiceRequest({ userId, reservationId, category, title, description }) {
  const cat = upper(category); if (!categories.has(cat)) throw fail("Invalid service request category.");
  const reservation = await prisma.reservation.findUnique({ where:{id:reservationId}, select:{id:true,userId:true,roomId:true,status:true} });
  if (!reservation) throw fail("Reservation not found.",404);
  if (reservation.userId !== userId) throw fail("You do not own this reservation.",403);
  if (reservation.status !== "CHECKED_IN") throw fail("Service requests require a checked-in reservation.",409);
  const request=await prisma.serviceRequest.create({ data:{userId,reservationId,roomId:reservation.roomId,category:cat,title:required(title,"Title",120),description:required(description,"Description",2000)}, include });
  await notifyServiceRequestCreated(request);return request;
}
export function getMyServiceRequests(userId) { return prisma.serviceRequest.findMany({where:{userId},include,orderBy:{createdAt:"desc"}}); }
export async function getServiceRequests({ status, priority, category, assignedToId }={}) {
  const s=upper(status),p=upper(priority),c=upper(category); if(s&&!statuses.has(s))throw fail("Invalid status filter.");if(p&&!priorities.has(p))throw fail("Invalid priority filter.");if(c&&!categories.has(c))throw fail("Invalid category filter.");
  return prisma.serviceRequest.findMany({where:{...(s?{status:s}:{}),...(p?{priority:p}:{}),...(c?{category:c}:{}),...(assignedToId?{assignedToId}:{})},include,orderBy:[{priority:"desc"},{createdAt:"asc"}]});
}
export function getServiceRequestAssignees() {
  return prisma.user.findMany({
    where: {
      status: "ACTIVE",
      roles: { some: { role: { name: { in: ["SUPER_ADMIN", "ADMIN", "SERVICE_MANAGER"] } } } },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      roles: { select: { role: { select: { name: true } } } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}
export async function getServiceRequest({id,userId,userRoles}) { const item=await prisma.serviceRequest.findUnique({where:{id},include});if(!item)throw fail("Service request not found.",404);if(item.userId!==userId&&!isStaff(userRoles))throw fail("You cannot view this service request.",403);if(!isStaff(userRoles)) item.comments=item.comments.filter((c)=>!c.isInternal);return item; }
export async function assignServiceRequest({id,assignedToId}) {
  const assignee=await prisma.user.findFirst({where:{id:assignedToId,status:"ACTIVE",roles:{some:{role:{name:{in:["SUPER_ADMIN","ADMIN","SERVICE_MANAGER"]}}}}},select:{id:true}});if(!assignee)throw fail("Eligible active assignee not found.",404);
  const item=await prisma.serviceRequest.findUnique({where:{id}});if(!item)throw fail("Service request not found.",404);if(["CLOSED","CANCELLED"].includes(item.status))throw fail("Closed or cancelled requests cannot be assigned.",409);
  const request=await prisma.serviceRequest.update({where:{id},data:{assignedToId,status:item.status==="OPEN"?"ASSIGNED":item.status},include});await notifyServiceRequestAssigned(request);return request;
}
export async function updateServiceRequestStatus({id,status}) { const next=upper(status);if(!statuses.has(next))throw fail("Invalid service request status.");const item=await prisma.serviceRequest.findUnique({where:{id}});if(!item)throw fail("Service request not found.",404);if(!transitions[item.status].includes(next))throw fail(`Cannot move service request from ${item.status} to ${next}.`,409);const request=await prisma.serviceRequest.update({where:{id},data:{status:next,resolvedAt:next==="RESOLVED"?new Date():next==="IN_PROGRESS"?null:undefined,closedAt:next==="CLOSED"?new Date():undefined},include});await notifyServiceRequestStatusChanged(request);return request; }
export async function updateServiceRequestPriority({id,priority}) { const p=upper(priority);if(!priorities.has(p))throw fail("Invalid service request priority.");try{return await prisma.serviceRequest.update({where:{id},data:{priority:p},include});}catch(e){if(e.code==="P2025")throw fail("Service request not found.",404);throw e;} }
export async function addServiceRequestComment({id,authorId,userRoles,content,isInternal=false}) { const item=await prisma.serviceRequest.findUnique({where:{id}});if(!item)throw fail("Service request not found.",404);const staff=isStaff(userRoles);if(item.userId!==authorId&&!staff)throw fail("You cannot comment on this service request.",403);if(isInternal&&!staff)throw fail("Only staff can add internal comments.",403);if(["CLOSED","CANCELLED"].includes(item.status))throw fail("Comments cannot be added to closed or cancelled requests.",409);return prisma.serviceRequestComment.create({data:{serviceRequestId:id,authorId,content:required(content,"Comment",2000),isInternal:Boolean(isInternal)},include:{author:{select:{id:true,firstName:true,lastName:true}}}}); }
export async function cancelOwnServiceRequest({id,userId}) { const item=await prisma.serviceRequest.findUnique({where:{id}});if(!item)throw fail("Service request not found.",404);if(item.userId!==userId)throw fail("You cannot cancel this service request.",403);if(!["OPEN","ASSIGNED"].includes(item.status))throw fail("This service request can no longer be cancelled.",409);return prisma.serviceRequest.update({where:{id},data:{status:"CANCELLED"},include}); }
