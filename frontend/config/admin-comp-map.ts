import type { ThirdKey } from '~/types/admin'

// Fixation
import FixNewProject from '~/components/admin/property/fixation/FixNewProject.vue'
import FixStockImport from '~/components/admin/property/fixation/FixStockImport.vue'
import FixApply from '~/components/admin/property/fixation/FixApply.vue'
import FixAudit from '~/components/admin/property/fixation/FixAudit.vue'
import FixMapping from '~/components/admin/property/fixation/FixMapping.vue'
import FixRoomFunction from '~/components/admin/property/fixation/FixRoomFunction.vue'
import FixLogs from '~/components/admin/property/fixation/FixLogs.vue'

// Allocation
import AllocationApproval from '~/components/admin/property/allocation/AllocationApproval.vue'
import AllocationAssignment from '~/components/admin/property/allocation/AllocationAssignment.vue'
import AllocationAdjustment from '~/components/admin/property/allocation/AllocationAdjustment.vue'
import AllocationRecords from '~/components/admin/property/allocation/AllocationRecords.vue'
import AllocationAnalysis from '~/components/admin/property/allocation/AllocationAnalysis.vue'

// Charging
import ChargingOverview from '~/components/admin/property/charging/ChargingOverview.vue'
import ChargingPersonal from '~/components/admin/property/charging/ChargingPersonal.vue'
import ChargingBills from '~/components/admin/property/charging/ChargingBills.vue'
import ChargingRecords from '~/components/admin/property/charging/ChargingRecords.vue'
import ChargingUrge from '~/components/admin/property/charging/ChargingUrge.vue'

// Operating
import OperatingOverview from '~/components/admin/property/operating/OperatingOverview.vue'
import OperatingProperties from '~/components/admin/property/operating/OperatingProperties.vue'
import OperatingContracts from '~/components/admin/property/operating/OperatingContracts.vue'
import OperatingRent from '~/components/admin/property/operating/OperatingRent.vue'
import OperatingAnalysis from '~/components/admin/property/operating/OperatingAnalysis.vue'

// Apartments
import ApartmentsOverview from '~/components/admin/property/apartments/ApartmentsOverview.vue'
import ApartmentsApplication from '~/components/admin/property/apartments/ApartmentsApplication.vue'
import ApartmentsRooms from '~/components/admin/property/apartments/ApartmentsRooms.vue'
import ApartmentsUtilities from '~/components/admin/property/apartments/ApartmentsUtilities.vue'
import ApartmentsDeposit from '~/components/admin/property/apartments/ApartmentsDeposit.vue'
import ApartmentsAssignment from '~/components/admin/property/apartments/ApartmentsAssignment.vue'

// Services
import ServicesWorkOrders from '~/components/admin/property/services/ServicesWorkOrders.vue'
import ServicesProperty from '~/components/admin/property/services/ServicesProperty.vue'
import ServicesStats from '~/components/admin/property/services/ServicesStats.vue'

// Inventory
import InventoryTasks from '~/components/admin/property/inventory/InventoryTasks.vue'
import InventoryDiscrepancies from '~/components/admin/property/inventory/InventoryDiscrepancies.vue'
import InventoryStats from '~/components/admin/property/inventory/InventoryStats.vue'

// Query
import QueryMultiRooms from '~/components/admin/property/query/QueryMultiRooms.vue'
import QueryMultiPeople from '~/components/admin/property/query/QueryMultiPeople.vue'
import QueryDepartment from '~/components/admin/property/query/QueryDepartment.vue'
import QueryQuota from '~/components/admin/property/query/QueryQuota.vue'
import QueryPublic from '~/components/admin/property/query/QueryPublic.vue'
import QueryCommercial from '~/components/admin/property/query/QueryCommercial.vue'

// Reports
import ReportsMoe from '~/components/admin/property/reports/ReportsMoe.vue'
import ReportsCustom from '~/components/admin/property/reports/ReportsCustom.vue'
import ReportsLogs from '~/components/admin/property/reports/ReportsLogs.vue'

export const adminCompMap: Record<ThirdKey, any> = {
  // Fixation
  fix_new_project: FixNewProject,
  fix_stock_import: FixStockImport,
  fix_apply: FixApply,
  fix_audit: FixAudit,
  fix_mapping: FixMapping,
  fix_room_function: FixRoomFunction,
  fix_logs: FixLogs,

  // Allocation
  allocation_approval: AllocationApproval,
  allocation_assignment: AllocationAssignment,
  allocation_adjustment: AllocationAdjustment,
  allocation_records: AllocationRecords,
  allocation_analysis: AllocationAnalysis,

  // Charging
  charging_overview: ChargingOverview,
  charging_personal: ChargingPersonal,
  charging_bills: ChargingBills,
  charging_records: ChargingRecords,
  charging_urge: ChargingUrge,

  // Operating
  operating_overview: OperatingOverview,
  operating_properties: OperatingProperties,
  operating_contracts: OperatingContracts,
  operating_rent: OperatingRent,
  operating_analysis: OperatingAnalysis,

  // Apartments
  apartments_overview: ApartmentsOverview,
  apartments_application: ApartmentsApplication,
  apartments_rooms: ApartmentsRooms,
  apartments_utilities: ApartmentsUtilities,
  apartments_deposit: ApartmentsDeposit,
  apartments_assignment: ApartmentsAssignment,

  // Services
  services_workorders: ServicesWorkOrders,
  services_property: ServicesProperty,
  services_stats: ServicesStats,

  // Inventory
  inventory_tasks: InventoryTasks,
  inventory_discrepancies: InventoryDiscrepancies,
  inventory_stats: InventoryStats,

  // Query
  query_multi_rooms: QueryMultiRooms,
  query_multi_people: QueryMultiPeople,
  query_department: QueryDepartment,
  query_quota: QueryQuota,
  query_public: QueryPublic,
  query_commercial: QueryCommercial,

  // Reports
  reports_moe: ReportsMoe,
  reports_custom: ReportsCustom,
  reports_logs: ReportsLogs,
}

