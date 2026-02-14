import type { ThirdKey } from '~/types/admin'

// Fixation
import FixNewProjectView from '~/views/admin/property/fixation/FixNewProjectView.vue'
import FixStockImportView from '~/views/admin/property/fixation/FixStockImportView.vue'
import FixApplyView from '~/views/admin/property/fixation/FixApplyView.vue'
import FixAuditView from '~/views/admin/property/fixation/FixAuditView.vue'
import FixMappingView from '~/views/admin/property/fixation/FixMappingView.vue'
import FixRoomFunctionView from '~/views/admin/property/fixation/FixRoomFunctionView.vue'
import FixLogsView from '~/views/admin/property/fixation/FixLogsView.vue'

// Allocation
import AllocationApplyView from '~/views/admin/property/allocation/AllocationApplyView.vue'
import AllocationApprovalView from '~/views/admin/property/allocation/AllocationApprovalView.vue'
import AllocationAssignmentView from '~/views/admin/property/allocation/AllocationAssignmentView.vue'
import AllocationAdjustmentView from '~/views/admin/property/allocation/AllocationAdjustmentView.vue'
import AllocationRecordsView from '~/views/admin/property/allocation/AllocationRecordsView.vue'
import AllocationAnalysisView from '~/views/admin/property/allocation/AllocationAnalysisView.vue'

// Charging
import ChargingOverviewView from '~/views/admin/property/charging/OverviewView.vue'
import ChargingPersonalView from '~/views/admin/property/charging/PersonalView.vue'
import ChargingBillsView from '~/views/admin/property/charging/BillsView.vue'
import ChargingRecordsView from '~/views/admin/property/charging/RecordsView.vue'
import ChargingUrgeView from '~/views/admin/property/charging/UrgeView.vue'

// Operating
import OperatingOverviewView from '~/views/admin/property/operating/OperatingOverviewView.vue'
import OperatingPropertiesView from '~/views/admin/property/operating/OperatingPropertiesView.vue'
import OperatingContractsView from '~/views/admin/property/operating/OperatingContractsView.vue'
import OperatingRentView from '~/views/admin/property/operating/OperatingRentView.vue'
import OperatingAnalysisView from '~/views/admin/property/operating/OperatingAnalysisView.vue'

// Apartments
import ApartmentsOverviewView from '~/views/admin/property/apartments/ApartmentsOverviewView.vue'
import ApartmentsApplicationView from '~/views/admin/property/apartments/ApartmentsApplicationView.vue'
import ApartmentsRoomsView from '~/views/admin/property/apartments/ApartmentsRoomsView.vue'
import ApartmentsUtilitiesView from '~/views/admin/property/apartments/ApartmentsUtilitiesView.vue'
import ApartmentsDepositView from '~/views/admin/property/apartments/ApartmentsDepositView.vue'
import ApartmentsAssignmentView from '~/views/admin/property/apartments/ApartmentsAssignmentView.vue'

// Services
import ServicesWorkOrdersView from '~/views/admin/property/services/ServicesWorkOrdersView.vue'
import ServicesPropertyView from '~/views/admin/property/services/ServicesPropertyView.vue'
import ServicesStatsView from '~/views/admin/property/services/ServicesStatsView.vue'

// Inventory
import InventoryTasksView from '~/views/admin/property/inventory/InventoryTasksView.vue'
import InventoryDiscrepanciesView from '~/views/admin/property/inventory/InventoryDiscrepanciesView.vue'
import InventoryStatsView from '~/views/admin/property/inventory/InventoryStatsView.vue'

// Query
import QueryMultiRoomsView from '~/views/admin/property/query/QueryMultiRoomsView.vue'
import QueryMultiPeopleView from '~/views/admin/property/query/QueryMultiPeopleView.vue'
import QueryDepartmentView from '~/views/admin/property/query/QueryDepartmentView.vue'
import QueryQuotaView from '~/views/admin/property/query/QueryQuotaView.vue'
import QueryPublicView from '~/views/admin/property/query/QueryPublicView.vue'
import QueryCommercialView from '~/views/admin/property/query/QueryCommercialView.vue'

// Reports
import ReportsMoeView from '~/views/admin/property/reports/ReportsMoeView.vue'
import ReportsCustomView from '~/views/admin/property/reports/ReportsCustomView.vue'
import ReportsLogsView from '~/views/admin/property/reports/ReportsLogsView.vue'

export const adminCompMap: Record<ThirdKey, any> = {
  // Fixation
  fix_new_project: FixNewProjectView,
  fix_stock_import: FixStockImportView,
  fix_apply: FixApplyView,
  fix_audit: FixAuditView,
  fix_mapping: FixMappingView,
  fix_room_function: FixRoomFunctionView,
  fix_logs: FixLogsView,

  // Allocation
  allocation_apply: AllocationApplyView,
  allocation_approval: AllocationApprovalView,
  allocation_assignment: AllocationAssignmentView,
  allocation_adjustment: AllocationAdjustmentView,
  allocation_records: AllocationRecordsView,
  allocation_analysis: AllocationAnalysisView,

  // Charging
  charging_overview: ChargingOverviewView,
  charging_personal: ChargingPersonalView,
  charging_bills: ChargingBillsView,
  charging_records: ChargingRecordsView,
  charging_urge: ChargingUrgeView,

  // Operating
  operating_overview: OperatingOverviewView,
  operating_properties: OperatingPropertiesView,
  operating_contracts: OperatingContractsView,
  operating_rent: OperatingRentView,
  operating_analysis: OperatingAnalysisView,

  // Apartments
  apartments_overview: ApartmentsOverviewView,
  apartments_application: ApartmentsApplicationView,
  apartments_rooms: ApartmentsRoomsView,
  apartments_utilities: ApartmentsUtilitiesView,
  apartments_deposit: ApartmentsDepositView,
  apartments_assignment: ApartmentsAssignmentView,

  // Services
  services_workorders: ServicesWorkOrdersView,
  services_property: ServicesPropertyView,
  services_stats: ServicesStatsView,

  // Inventory
  inventory_tasks: InventoryTasksView,
  inventory_discrepancies: InventoryDiscrepanciesView,
  inventory_stats: InventoryStatsView,

  // Query
  query_multi_rooms: QueryMultiRoomsView,
  query_multi_people: QueryMultiPeopleView,
  query_department: QueryDepartmentView,
  query_quota: QueryQuotaView,
  query_public: QueryPublicView,
  query_commercial: QueryCommercialView,

  // Reports
  reports_moe: ReportsMoeView,
  reports_custom: ReportsCustomView,
  reports_logs: ReportsLogsView,
}

