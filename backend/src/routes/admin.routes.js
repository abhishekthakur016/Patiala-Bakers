import { Router } from 'express';
import { ah } from '../utils/http.js';
import { validate } from '../middleware/validate.js';
import { requirePermission as can, requireStaff } from '../middleware/auth.js';
import { imageUpload } from '../middleware/upload.js';
import * as S from '../validators/schemas.js';
import * as O from '../controllers/admin.orders.controller.js';
import * as C from '../controllers/admin.catalog.controller.js';
import * as M from '../controllers/admin.misc.controller.js';

const r = Router();
r.use(requireStaff);

r.get('/dashboard', ah(M.getDashboard));

// Orders
r.get('/orders', can('orders'), validate({ query: S.orderQuerySchema }), ah(O.listOrders));
r.get('/orders/export.csv', can('reports'), ah(O.exportOrdersCsv));
r.post('/orders', can('orders'), validate({ body: S.manualOrderSchema }), ah(O.createManualOrder));
r.get('/orders/:id', can('orders'), ah(O.getOrder));
r.patch('/orders/:id', can('orders'), validate({ body: S.orderPatchSchema }), ah(O.patchOrder));
r.post('/orders/:id/status', can('orders'), validate({ body: S.statusSchema }), ah(O.updateStatus));
r.post('/orders/:id/payments', can('orders'), validate({ body: S.paymentSchema }), ah(O.addPayment));
r.post('/orders/:id/refund', can('orders'), validate({ body: S.refundSchema }), ah(O.refund));
r.delete('/orders/:id', can('settings'), ah(O.deleteOrder));

// Production & calendar
r.get('/production', can('production'), ah(O.production));
r.get('/calendar', can('calendar'), ah(O.calendar));
r.post('/calendar/block', can('calendar'), validate({ body: S.blockSchema }), ah(M.blockDate));
r.post('/calendar/unblock', can('calendar'), validate({ body: S.blockSchema }), ah(M.unblockDate));

// Products & inventory
r.get('/products', can('products'), ah(C.listAdminProducts));
r.post('/products', can('products'), validate({ body: S.productSchema }), ah(C.createProduct));
r.patch('/products/:id', can('products'), validate({ body: S.productPatchSchema }), ah(C.updateProduct));
r.post('/products/:id/archive', can('products'), ah(C.archiveProduct));
r.post('/uploads', can('products'), imageUpload.array('images', 6), ah(C.uploadImages));
r.post('/uploads/delete', can('products'), ah(C.removeImage));

// Bulk pricing
r.post('/pricing/preview', can('pricing'), validate({ body: S.ruleSchema }), ah(C.pricingPreview));
r.post('/pricing/apply', can('pricing'), validate({ body: S.applySchema }), ah(C.pricingApply));
r.get('/pricing/audit', can('pricing'), ah(C.pricingAudit));
r.post('/pricing/audit/:id/rollback', can('pricing'), ah(C.pricingRollback));
r.get('/pricing/schedules', can('pricing'), ah(C.listSchedules));
r.post('/pricing/schedules', can('pricing'), validate({ body: S.scheduleSchema }), ah(C.createSchedule));
r.post('/pricing/schedules/:id/cancel', can('pricing'), ah(C.cancelSchedule));
r.post('/pricing/csv/preview', can('pricing'), validate({ body: S.csvSchema }), ah(C.csvPreview));

// Enquiries
r.get('/enquiries', can('enquiries'), ah(M.listEnquiries));
r.get('/enquiries/:id', can('enquiries'), ah(M.getEnquiry));
r.patch('/enquiries/:id', can('enquiries'), validate({ body: S.enquiryPatchSchema }), ah(M.patchEnquiry));
r.post('/enquiries/:id/notes', can('enquiries'), validate({ body: S.enquiryNoteSchema }), ah(M.addEnquiryNote));
r.post('/enquiries/:id/quote', can('enquiries'), validate({ body: S.quoteSchema }), ah(M.quoteEnquiry));
r.post('/enquiries/:id/convert', can('enquiries'), validate({ body: S.convertSchema }), ah(M.convertEnquiry));

// Customers
r.get('/customers', can('customers'), ah(M.listCustomers));
r.get('/customers/:email', can('customers'), ah(M.getCustomer));
r.patch('/customers/:email', can('customers'), validate({ body: S.customerPatchSchema }), ah(M.patchCustomer));

// Reports & AI
r.get('/reports', can('reports'), ah(M.getReports));
r.get('/ai/suggestions', can('ai'), M.aiSuggestions);
r.post('/ai/ask', can('ai'), validate({ body: S.aiSchema }), ah(M.aiAsk));

// Settings, staff, messages
r.get('/settings', ah(M.getAdminSettings));
r.patch('/settings', can('settings'), validate({ body: S.settingsSchema }), ah(M.updateSettings));
r.get('/staff', can('settings'), ah(M.listStaff));
r.post('/staff', can('settings'), validate({ body: S.staffSchema }), ah(M.createStaff));
r.patch('/staff/:id', can('settings'), validate({ body: S.staffSchema.partial() }), ah(M.updateStaff));
r.get('/messages', can('customers'), ah(M.listMessages));
r.post('/messages/:id/handled', can('customers'), ah(M.markMessage));

export default r;
