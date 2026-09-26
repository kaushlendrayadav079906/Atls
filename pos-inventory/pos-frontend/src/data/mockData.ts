import type {
  Product,
  DashboardSummary,
  Sale,
  AdminDashboardData,
  DateRange,
  ReportPreviewData,
  ReportPreviewRow,
  OperatorDashboardData,
  CustomerInsightsData,
} from '../types';

/**
 * Centralized Mock Data for POS Application
 * This file contains all dummy/mock data used across the application
 */

// ============================================================================
// PRODUCTS DATA (from Maybelline API)
// ============================================================================

export const mockProducts: Product[] = [
  // ============================================================================
  // SPORTS BRA COLLECTION
  // ============================================================================
  {
    id: "1",
    name: "Sports Bra - Black",
    price: 1499,
    barcode: "ELA-SB-BLK-001",
    stock: 45,
    image: "/src/assets/Ela Photoshoot/Sports Bra/Black/ELLA-0126 copy.webp"
  },
  {
    id: "2",
    name: "Sports Bra - Ela Magenta",
    price: 1499,
    barcode: "ELA-SB-MAG-001",
    stock: 38,
    image: "/src/assets/Ela Photoshoot/Sports Bra/Ela Magenta/ELLA-0089 copy.webp"
  },
  {
    id: "3",
    name: "Sports Bra - Grey",
    price: 1499,
    barcode: "ELA-SB-GRY-001",
    stock: 52,
    image: "/src/assets/Ela Photoshoot/Sports Bra/Grey/ELLA-0102 copy.webp"
  },
  {
    id: "4",
    name: "Sports Bra - Lilac",
    price: 1499,
    barcode: "ELA-SB-LIL-001",
    stock: 29,
    image: "/src/assets/Ela Photoshoot/Sports Bra/Lilac/ELLA-0116 copy.webp"
  },
  {
    id: "5",
    name: "Sports Bra - Navy",
    price: 1499,
    barcode: "ELA-SB-NAV-001",
    stock: 41,
    image: "/src/assets/Ela Photoshoot/Sports Bra/Navy/ELLA-0054 copy.webp"
  },
  {
    id: "6",
    name: "Sports Bra - Paradise Pink",
    price: 1499,
    barcode: "ELA-SB-PPK-001",
    stock: 35,
    image: "/src/assets/Ela Photoshoot/Sports Bra/Paradise Pink/ELLA-0108 copy.webp"
  },
  
  // ============================================================================
  // PADDED T-SHIRT BRA COLLECTION
  // ============================================================================
  {
    id: "7",
    name: "Padded T-Shirt Bra - Black",
    price: 1899,
    barcode: "ELA-PTB-BLK-001",
    stock: 55,
    image: "/src/assets/Ela Photoshoot/Padded T-Shirt Bra/Black/ELLA-0297 copy.webp"
  },
  {
    id: "8",
    name: "Padded T-Shirt Bra - Lilac",
    price: 1899,
    barcode: "ELA-PTB-LIL-001",
    stock: 42,
    image: "/src/assets/Ela Photoshoot/Padded T-Shirt Bra/Lilac/ELLA-0229 copy.webp"
  },
  {
    id: "9",
    name: "Padded T-Shirt Bra - Navy",
    price: 1899,
    barcode: "ELA-PTB-NAV-001",
    stock: 38,
    image: "/src/assets/Ela Photoshoot/Padded T-Shirt Bra/Navy/ELLA-0239 copy.webp"
  },
  {
    id: "10",
    name: "Padded T-Shirt Bra - Nude",
    price: 1899,
    barcode: "ELA-PTB-NUD-001",
    stock: 60,
    image: "/src/assets/Ela Photoshoot/Padded T-Shirt Bra/Nude/ELLA-0304 copy.webp"
  },
  {
    id: "11",
    name: "Padded T-Shirt Bra - Sundried Tomato",
    price: 1899,
    barcode: "ELA-PTB-SDT-001",
    stock: 33,
    image: "/src/assets/Ela Photoshoot/Padded T-Shirt Bra/Sundried Tomato/ELLA-0221 copy.webp"
  },

  // ============================================================================
  // NON PADDED ENCIRCLE BRA COLLECTION
  // ============================================================================
  {
    id: "12",
    name: "Non Padded Encircle Bra - Black",
    price: 1699,
    barcode: "ELA-NPEB-BLK-001",
    stock: 48,
    image: "/src/assets/Ela Photoshoot/Non Padded Encircle Bra/Black/ELLA-0365 copy.webp"
  },
  {
    id: "13",
    name: "Non Padded Encircle Bra - Nude",
    price: 1699,
    barcode: "ELA-NPEB-NUD-001",
    stock: 51,
    image: "/src/assets/Ela Photoshoot/Non Padded Encircle Bra/Nude/ELLA-0350 copy.webp"
  },
  {
    id: "14",
    name: "Non Padded Encircle Bra - Paradise Pink",
    price: 1699,
    barcode: "ELA-NPEB-PPK-001",
    stock: 28,
    image: "/src/assets/Ela Photoshoot/Non Padded Encircle Bra/Paradise Pink/ELLA-0335 copy.webp"
  },
  {
    id: "15",
    name: "Non Padded Encircle Bra - Sundried Tomato",
    price: 1699,
    barcode: "ELA-NPEB-SDT-001",
    stock: 36,
    image: "/src/assets/Ela Photoshoot/Non Padded Encircle Bra/Sundried Tomato/ELLA-0358 copy.webp"
  },
  {
    id: "16",
    name: "Non Padded Encircle Bra - White",
    price: 1699,
    barcode: "ELA-NPEB-WHT-001",
    stock: 44,
    image: "/src/assets/Ela Photoshoot/Non Padded Encircle Bra/White/ELLA-0343 copy.webp"
  },

  // ============================================================================
  // NON PADDED SUPER SUPPORT BRA COLLECTION
  // ============================================================================
  {
    id: "17",
    name: "Non Padded Super Support Bra - Black",
    price: 1799,
    barcode: "ELA-NPSSB-BLK-001",
    stock: 40,
    image: "/src/assets/Ela Photoshoot/Non Padded Super Support Bra/Black/ELLA-0265 copy.webp"
  },
  {
    id: "18",
    name: "Non Padded Super Support Bra - Grey",
    price: 1799,
    barcode: "ELA-NPSSB-GRY-001",
    stock: 37,
    image: "/src/assets/Ela Photoshoot/Non Padded Super Support Bra/Grey/ELLA-0254 copy.webp"
  },
  {
    id: "19",
    name: "Non Padded Super Support Bra - Paradise Pink",
    price: 1799,
    barcode: "ELA-NPSSB-PPK-001",
    stock: 31,
    image: "/src/assets/Ela Photoshoot/Non Padded Super Support Bra/Paradise Pink/ELLA-0272 copy.webp"
  },
  {
    id: "20",
    name: "Non Padded Super Support Bra - White",
    price: 1799,
    barcode: "ELA-NPSSB-WHT-001",
    stock: 46,
    image: "/src/assets/Ela Photoshoot/Non Padded Super Support Bra/White/ELLA-0279 copy.webp"
  },

  // ============================================================================
  // CAMISOLE PADDED WITHOUT LACE COLLECTION
  // ============================================================================
  {
    id: "21",
    name: "Camisole Padded Without Lace - Black",
    price: 1299,
    barcode: "ELA-CPWL-BLK-001",
    stock: 58,
    image: "/src/assets/Ela Photoshoot/Camisole Padded Without Lace/Black/ELLA-0176 copy.webp"
  },
  {
    id: "22",
    name: "Camisole Padded Without Lace - Grey",
    price: 1299,
    barcode: "ELA-CPWL-GRY-001",
    stock: 49,
    image: "/src/assets/Ela Photoshoot/Camisole Padded Without Lace/Grey/ELLA-0190 copy.webp"
  },
  {
    id: "23",
    name: "Camisole Padded Without Lace - Nude",
    price: 1299,
    barcode: "ELA-CPWL-NUD-001",
    stock: 53,
    image: "/src/assets/Ela Photoshoot/Camisole Padded Without Lace/Nude/ELLA-0185 copy.webp"
  },

  // ============================================================================
  // NON PADDED LACE CAMISOLE COLLECTION
  // ============================================================================
  {
    id: "24",
    name: "Non Padded Lace Camisole - Black",
    price: 1399,
    barcode: "ELA-NPLC-BLK-001",
    stock: 42,
    image: "/src/assets/Ela Photoshoot/Non Padded Lace Camisole/Black/ELLA-0205 copy.webp"
  },
  {
    id: "25",
    name: "Non Padded Lace Camisole - Grey",
    price: 1399,
    barcode: "ELA-NPLC-GRY-001",
    stock: 39,
    image: "/src/assets/Ela Photoshoot/Non Padded Lace Camisole/Grey/ELLA-0200 copy.webp"
  },
  {
    id: "26",
    name: "Non Padded Lace Camisole - Nude",
    price: 1399,
    barcode: "ELA-NPLC-NUD-001",
    stock: 47,
    image: "/src/assets/Ela Photoshoot/Non Padded Lace Camisole/Nude/ELLA-0215 copy.webp"
  },

  // ============================================================================
  // BOY SHORTS COLLECTION (Multi-Pack)
  // ============================================================================
  {
    id: "27",
    name: "Boy Shorts - Black & Magenta (Pack of 2)",
    price: 1199,
    barcode: "ELA-BS-BM2-001",
    stock: 35,
    image: "/src/assets/Ela Photoshoot/Boy Shorts/Black & Magenta (Pack of 2)/ELLA-0429 copy.webp"
  },
  {
    id: "28",
    name: "Boy Shorts - Grey & Pink (Pack of 2)",
    price: 1199,
    barcode: "ELA-BS-GP2-001",
    stock: 32,
    image: "/src/assets/Ela Photoshoot/Boy Shorts/Grey & Pink (Pack of 2)/ELLA-0424 copy.webp"
  },
  {
    id: "29",
    name: "Boy Shorts - Navy & Nude (Pack of 2)",
    price: 1199,
    barcode: "ELA-BS-NN2-001",
    stock: 29,
    image: "/src/assets/Ela Photoshoot/Boy Shorts/Navy & Nude (Pack of 2)/ELLA-0415 copy.webp"
  },

  // ============================================================================
  // MID-RISE HIPSTER PANTY COLLECTION (Multi-Pack)
  // ============================================================================
  {
    id: "30",
    name: "Mid-Rise Hipster Panty - Black, Pink, Nude (Pack of 3)",
    price: 1599,
    barcode: "ELA-MRHP-BPN3-001",
    stock: 40,
    image: "/src/assets/Ela Photoshoot/Mid-Rise Hipster Panty/Black, Pink, Nude (Pack of 3)/ELLA-0451 copy.webp"
  },
  {
    id: "31",
    name: "Mid-Rise Hipster Panty - Magenta, Grey, Navy (Pack of 3)",
    price: 1599,
    barcode: "ELA-MRHP-MGN3-001",
    stock: 37,
    image: "/src/assets/Ela Photoshoot/Mid-Rise Hipster Panty/Magenta, Grey, Navy (Pack of 3)/ELLA-0448 copy.webp"
  },

  // ============================================================================
  // FULL BRIEF HIGH RISE PANTY COLLECTION (Multi-Pack)
  // ============================================================================
  {
    id: "32",
    name: "Full Brief High Rise Panty - Black, Pink, Nude (Pack of 3)",
    price: 1599,
    barcode: "ELA-FBHRP-BPN3-001",
    stock: 43,
    image: "/src/assets/Ela Photoshoot/Full Brief High Rise Panty/Black, Pink, Nude (Pack of 3)/ELLA-0388 copy.webp"
  },
  {
    id: "33",
    name: "Full Brief High Rise Panty - Magenta, Grey, Navy (Pack of 3)",
    price: 1599,
    barcode: "ELA-FBHRP-MGN3-001",
    stock: 38,
    image: "/src/assets/Ela Photoshoot/Full Brief High Rise Panty/Magenta, Grey, Navy (Pack of 3)/ELLA-0385 copy.webp"
  }
];

// ============================================================================
// DASHBOARD SUMMARY DATA
// ============================================================================

export let mockDashboardSummary: DashboardSummary = {
  todayTotal: 2847.65,
  billCount: 67,
  itemsSoldCount: 214,
};

const mockCustomerInsights: CustomerInsightsData = {
  topCustomers: [
    { cardCode: 'C001', cardName: 'Priya Shah', totalSpend: 48250, billCount: 12, averageOrderValue: 4020.83 },
    { cardCode: 'C002', cardName: 'Amit Verma', totalSpend: 39140, billCount: 9, averageOrderValue: 4348.89 },
    { cardCode: 'C003', cardName: 'Neha Kapoor', totalSpend: 32470, billCount: 7, averageOrderValue: 4638.57 },
  ],
  repeatCustomerCount: 42,
  newCustomerCount: 18,
  repeatRate: 70,
  totalCLV: 285000,
};

const mockAdminDashboardByRange: Record<DateRange, AdminDashboardData> = {
  daily: {
    totalRevenue: 182450,
    billCount: 68,
    itemsSoldCount: 241,
    averageBillValue: 2683.09,
    activeBranches: 5,
    activeUsers: 17,
    previousRevenue: 165230,
    growthPercent: 10.42,
    topBranch: { branchId: 'BLR-01', branchName: 'Bangalore Indiranagar', total: 51540, billCount: 18 },
    branchBreakdown: [
      { branchId: 'BLR-01', branchName: 'Bangalore Indiranagar', total: 51540, billCount: 18 },
      { branchId: 'MUM-02', branchName: 'Mumbai Bandra', total: 42680, billCount: 16 },
      { branchId: 'DEL-03', branchName: 'Delhi Vasant Kunj', total: 35120, billCount: 14 },
      { branchId: 'HYD-04', branchName: 'Hyderabad Jubilee Hills', total: 29110, billCount: 11 },
      { branchId: 'PNQ-05', branchName: 'Pune Koregaon Park', total: 24000, billCount: 9 },
    ],
    paymentSplit: [
      { method: 'card', total: 70120, billCount: 25 },
      { method: 'upi', total: 62400, billCount: 24 },
      { method: 'cash', total: 41130, billCount: 15 },
      { method: 'wallet', total: 8810, billCount: 4 },
    ],
    trend: [
      { label: '09:00', total: 18320, billCount: 7 },
      { label: '11:00', total: 29240, billCount: 11 },
      { label: '13:00', total: 35590, billCount: 13 },
      { label: '15:00', total: 30910, billCount: 12 },
      { label: '17:00', total: 41220, billCount: 15 },
      { label: '19:00', total: 27170, billCount: 10 },
    ],
    topProducts: [
      { itemCode: 'ELA-SB-BLK-001', itemName: 'Sports Bra - Black', quantity: 36, revenue: 53964 },
      { itemCode: 'ELA-PTB-NUD-001', itemName: 'Padded T-Shirt Bra - Nude', quantity: 30, revenue: 56970 },
      { itemCode: 'ELA-NPEB-WHT-001', itemName: 'Non Padded Encircle Bra - White', quantity: 24, revenue: 40776 },
      { itemCode: 'ELA-BS-GP2-001', itemName: 'Boy Shorts - Grey & Pink (Pack of 2)', quantity: 22, revenue: 26378 },
      { itemCode: 'ELA-MRHP-BPN3-001', itemName: 'Mid-Rise Hipster Panty - Black, Pink, Nude (Pack of 3)', quantity: 18, revenue: 28782 },
    ],
    topEmployees: [
      { employeeCode: 'EMP-01', total: 68420, billCount: 24 },
      { employeeCode: 'EMP-02', total: 55310, billCount: 21 },
      { employeeCode: 'EMP-03', total: 42180, billCount: 16 },
    ],
    customerInsights: mockCustomerInsights,
    totalReturns: 4,
    exchangeCount: 2,
    refundCount: 2,
    returnRate: 5.88,
    totalRefundedAmount: 7580,
    netRevenueAfterReturns: 174870,
    topReturnReasons: [
      { reason: 'Size issue', count: 2 },
      { reason: 'Defective product', count: 1 },
      { reason: 'Wrong item', count: 1 },
    ],
  },
  weekly: {
    totalRevenue: 1248650,
    billCount: 438,
    itemsSoldCount: 1531,
    averageBillValue: 2850.8,
    activeBranches: 5,
    activeUsers: 17,
    previousRevenue: 1132010,
    growthPercent: 10.3,
    topBranch: { branchId: 'BLR-01', branchName: 'Bangalore Indiranagar', total: 319240, billCount: 111 },
    branchBreakdown: [
      { branchId: 'BLR-01', branchName: 'Bangalore Indiranagar', total: 319240, billCount: 111 },
      { branchId: 'MUM-02', branchName: 'Mumbai Bandra', total: 277930, billCount: 98 },
      { branchId: 'DEL-03', branchName: 'Delhi Vasant Kunj', total: 241180, billCount: 87 },
      { branchId: 'HYD-04', branchName: 'Hyderabad Jubilee Hills', total: 209610, billCount: 76 },
      { branchId: 'PNQ-05', branchName: 'Pune Koregaon Park', total: 200690, billCount: 66 },
    ],
    paymentSplit: [
      { method: 'card', total: 448230, billCount: 158 },
      { method: 'upi', total: 402520, billCount: 151 },
      { method: 'cash', total: 330900, billCount: 115 },
      { method: 'wallet', total: 67000, billCount: 14 },
    ],
    trend: [
      { label: 'Mon', total: 164520, billCount: 56 },
      { label: 'Tue', total: 171340, billCount: 61 },
      { label: 'Wed', total: 189110, billCount: 67 },
      { label: 'Thu', total: 175900, billCount: 63 },
      { label: 'Fri', total: 207430, billCount: 73 },
      { label: 'Sat', total: 191880, billCount: 68 },
      { label: 'Sun', total: 148470, billCount: 50 },
    ],
    topProducts: [
      { itemCode: 'ELA-PTB-NUD-001', itemName: 'Padded T-Shirt Bra - Nude', quantity: 196, revenue: 372204 },
      { itemCode: 'ELA-SB-BLK-001', itemName: 'Sports Bra - Black', quantity: 180, revenue: 269820 },
      { itemCode: 'ELA-NPEB-WHT-001', itemName: 'Non Padded Encircle Bra - White', quantity: 132, revenue: 224268 },
      { itemCode: 'ELA-FBHRP-MGN3-001', itemName: 'Full Brief High Rise Panty - Magenta, Grey, Navy (Pack of 3)', quantity: 101, revenue: 161499 },
      { itemCode: 'ELA-CPWL-BLK-001', itemName: 'Camisole Padded Without Lace - Black', quantity: 99, revenue: 128601 },
    ],
    topEmployees: [
      { employeeCode: 'EMP-01', total: 438200, billCount: 153 },
      { employeeCode: 'EMP-02', total: 371450, billCount: 133 },
      { employeeCode: 'EMP-03', total: 298400, billCount: 108 },
    ],
    customerInsights: mockCustomerInsights,
    totalReturns: 23,
    exchangeCount: 12,
    refundCount: 11,
    returnRate: 5.25,
    totalRefundedAmount: 61200,
    netRevenueAfterReturns: 1187450,
    topReturnReasons: [
      { reason: 'Size issue', count: 10 },
      { reason: 'Defective product', count: 7 },
      { reason: 'Changed mind', count: 6 },
    ],
  },
  monthly: {
    totalRevenue: 4972300,
    billCount: 1718,
    itemsSoldCount: 6089,
    averageBillValue: 2894.24,
    activeBranches: 5,
    activeUsers: 17,
    previousRevenue: 4511000,
    growthPercent: 10.22,
    topBranch: { branchId: 'BLR-01', branchName: 'Bangalore Indiranagar', total: 1298400, billCount: 431 },
    branchBreakdown: [
      { branchId: 'BLR-01', branchName: 'Bangalore Indiranagar', total: 1298400, billCount: 431 },
      { branchId: 'MUM-02', branchName: 'Mumbai Bandra', total: 1092200, billCount: 372 },
      { branchId: 'DEL-03', branchName: 'Delhi Vasant Kunj', total: 966500, billCount: 339 },
      { branchId: 'HYD-04', branchName: 'Hyderabad Jubilee Hills', total: 862700, billCount: 302 },
      { branchId: 'PNQ-05', branchName: 'Pune Koregaon Park', total: 752500, billCount: 274 },
    ],
    paymentSplit: [
      { method: 'card', total: 1848300, billCount: 626 },
      { method: 'upi', total: 1632100, billCount: 599 },
      { method: 'cash', total: 1243900, billCount: 443 },
      { method: 'wallet', total: 248000, billCount: 50 },
    ],
    trend: [
      { label: 'Week 1', total: 1132400, billCount: 388 },
      { label: 'Week 2', total: 1215800, billCount: 425 },
      { label: 'Week 3', total: 1294600, billCount: 453 },
      { label: 'Week 4', total: 1329500, billCount: 452 },
    ],
    topProducts: [
      { itemCode: 'ELA-PTB-NUD-001', itemName: 'Padded T-Shirt Bra - Nude', quantity: 708, revenue: 1344492 },
      { itemCode: 'ELA-SB-BLK-001', itemName: 'Sports Bra - Black', quantity: 665, revenue: 996835 },
      { itemCode: 'ELA-NPEB-WHT-001', itemName: 'Non Padded Encircle Bra - White', quantity: 524, revenue: 890476 },
      { itemCode: 'ELA-FBHRP-MGN3-001', itemName: 'Full Brief High Rise Panty - Magenta, Grey, Navy (Pack of 3)', quantity: 410, revenue: 655590 },
      { itemCode: 'ELA-CPWL-BLK-001', itemName: 'Camisole Padded Without Lace - Black', quantity: 389, revenue: 505211 },
    ],
    topEmployees: [
      { employeeCode: 'EMP-01', total: 1712400, billCount: 590 },
      { employeeCode: 'EMP-02', total: 1489300, billCount: 517 },
      { employeeCode: 'EMP-03', total: 1198600, billCount: 418 },
    ],
    customerInsights: mockCustomerInsights,
    totalReturns: 89,
    exchangeCount: 46,
    refundCount: 43,
    returnRate: 5.18,
    totalRefundedAmount: 243100,
    netRevenueAfterReturns: 4729200,
    topReturnReasons: [
      { reason: 'Size issue', count: 38 },
      { reason: 'Defective product', count: 27 },
      { reason: 'Changed mind', count: 24 },
    ],
  },
  yearly: {
    totalRevenue: 56940000,
    billCount: 19520,
    itemsSoldCount: 68390,
    averageBillValue: 2917.01,
    activeBranches: 5,
    activeUsers: 17,
    previousRevenue: 50820000,
    growthPercent: 12.04,
    topBranch: { branchId: 'BLR-01', branchName: 'Bangalore Indiranagar', total: 14560000, billCount: 4700 },
    branchBreakdown: [
      { branchId: 'BLR-01', branchName: 'Bangalore Indiranagar', total: 14560000, billCount: 4700 },
      { branchId: 'MUM-02', branchName: 'Mumbai Bandra', total: 12200000, billCount: 4180 },
      { branchId: 'DEL-03', branchName: 'Delhi Vasant Kunj', total: 10840000, billCount: 3750 },
      { branchId: 'HYD-04', branchName: 'Hyderabad Jubilee Hills', total: 10120000, billCount: 3460 },
      { branchId: 'PNQ-05', branchName: 'Pune Koregaon Park', total: 9220000, billCount: 3430 },
    ],
    paymentSplit: [
      { method: 'card', total: 21080000, billCount: 7180 },
      { method: 'upi', total: 19240000, billCount: 6890 },
      { method: 'cash', total: 14270000, billCount: 5100 },
      { method: 'wallet', total: 2350000, billCount: 350 },
    ],
    trend: [
      { label: 'Q1', total: 13210000, billCount: 4520 },
      { label: 'Q2', total: 13890000, billCount: 4680 },
      { label: 'Q3', total: 14570000, billCount: 5030 },
      { label: 'Q4', total: 15270000, billCount: 5290 },
    ],
    topProducts: [
      { itemCode: 'ELA-PTB-NUD-001', itemName: 'Padded T-Shirt Bra - Nude', quantity: 7890, revenue: 14983110 },
      { itemCode: 'ELA-SB-BLK-001', itemName: 'Sports Bra - Black', quantity: 7440, revenue: 11152560 },
      { itemCode: 'ELA-NPEB-WHT-001', itemName: 'Non Padded Encircle Bra - White', quantity: 6120, revenue: 10397880 },
      { itemCode: 'ELA-FBHRP-MGN3-001', itemName: 'Full Brief High Rise Panty - Magenta, Grey, Navy (Pack of 3)', quantity: 4810, revenue: 7685190 },
      { itemCode: 'ELA-CPWL-BLK-001', itemName: 'Camisole Padded Without Lace - Black', quantity: 4560, revenue: 5923440 },
    ],
    topEmployees: [
      { employeeCode: 'EMP-01', total: 19480000, billCount: 6620 },
      { employeeCode: 'EMP-02', total: 16950000, billCount: 5810 },
      { employeeCode: 'EMP-03', total: 13720000, billCount: 4730 },
    ],
    customerInsights: mockCustomerInsights,
    totalReturns: 1012,
    exchangeCount: 524,
    refundCount: 488,
    returnRate: 5.18,
    totalRefundedAmount: 2780000,
    netRevenueAfterReturns: 54160000,
    topReturnReasons: [
      { reason: 'Size issue', count: 441 },
      { reason: 'Defective product', count: 308 },
      { reason: 'Changed mind', count: 263 },
    ],
  },
  all_time: {
    totalRevenue: 154320000,
    billCount: 53760,
    itemsSoldCount: 189420,
    averageBillValue: 2870.54,
    activeBranches: 5,
    activeUsers: 17,
    previousRevenue: 0,
    growthPercent: 0,
    topBranch: { branchId: 'BLR-01', branchName: 'Bangalore Indiranagar', total: 39340000, billCount: 13120 },
    branchBreakdown: [
      { branchId: 'BLR-01', branchName: 'Bangalore Indiranagar', total: 39340000, billCount: 13120 },
      { branchId: 'MUM-02', branchName: 'Mumbai Bandra', total: 33150000, billCount: 11430 },
      { branchId: 'DEL-03', branchName: 'Delhi Vasant Kunj', total: 29570000, billCount: 10540 },
      { branchId: 'HYD-04', branchName: 'Hyderabad Jubilee Hills', total: 28010000, billCount: 9540 },
      { branchId: 'PNQ-05', branchName: 'Pune Koregaon Park', total: 24250000, billCount: 9130 },
    ],
    paymentSplit: [
      { method: 'card', total: 57610000, billCount: 19830 },
      { method: 'upi', total: 52390000, billCount: 18850 },
      { method: 'cash', total: 38480000, billCount: 14520 },
      { method: 'wallet', total: 5840000, billCount: 560 },
    ],
    trend: [
      { label: '2023', total: 42180000, billCount: 14920 },
      { label: '2024', total: 48460000, billCount: 16840 },
      { label: '2025', total: 54120000, billCount: 18860 },
      { label: '2026', total: 9560000, billCount: 3140 },
    ],
    topProducts: [
      { itemCode: 'ELA-PTB-NUD-001', itemName: 'Padded T-Shirt Bra - Nude', quantity: 22340, revenue: 42403660 },
      { itemCode: 'ELA-SB-BLK-001', itemName: 'Sports Bra - Black', quantity: 21180, revenue: 31748820 },
      { itemCode: 'ELA-NPEB-WHT-001', itemName: 'Non Padded Encircle Bra - White', quantity: 17650, revenue: 29972350 },
      { itemCode: 'ELA-FBHRP-MGN3-001', itemName: 'Full Brief High Rise Panty - Magenta, Grey, Navy (Pack of 3)', quantity: 13810, revenue: 22092690 },
      { itemCode: 'ELA-CPWL-BLK-001', itemName: 'Camisole Padded Without Lace - Black', quantity: 12970, revenue: 16858030 },
    ],
    topEmployees: [
      { employeeCode: 'EMP-01', total: 53000000, billCount: 18120 },
      { employeeCode: 'EMP-02', total: 46200000, billCount: 15880 },
      { employeeCode: 'EMP-03', total: 37400000, billCount: 12890 },
    ],
    customerInsights: mockCustomerInsights,
    totalReturns: 2820,
    exchangeCount: 1460,
    refundCount: 1360,
    returnRate: 5.25,
    totalRefundedAmount: 7650000,
    netRevenueAfterReturns: 146670000,
    topReturnReasons: [
      { reason: 'Size issue', count: 1230 },
      { reason: 'Defective product', count: 860 },
      { reason: 'Changed mind', count: 730 },
    ],
  },
};

const mockReportRows: ReportPreviewRow[] = [
  {
    docNum: '100521',
    date: '2026-04-22',
    customer: 'Walk-in Customer',
    paymentMethod: 'card',
    subtotal: 4298,
    discount: 200,
    gst: 737.64,
    total: 4835.64,
  },
  {
    docNum: '100522',
    date: '2026-04-22',
    customer: 'Priya Shah',
    paymentMethod: 'upi',
    subtotal: 3398,
    discount: 100,
    gst: 593.64,
    total: 3891.64,
  },
  {
    docNum: '100526',
    date: '2026-04-23',
    customer: 'Aarav Mehta',
    paymentMethod: 'cash',
    subtotal: 2899,
    discount: 0,
    gst: 521.82,
    total: 3420.82,
  },
  {
    docNum: '100529',
    date: '2026-04-24',
    customer: 'Nisha Rao',
    paymentMethod: 'card',
    subtotal: 5197,
    discount: 250,
    gst: 890.46,
    total: 5837.46,
  },
  {
    docNum: '100533',
    date: '2026-04-25',
    customer: 'Walk-in Customer',
    paymentMethod: 'upi',
    subtotal: 2498,
    discount: 0,
    gst: 449.64,
    total: 2947.64,
  },
  {
    docNum: '100535',
    date: '2026-04-26',
    customer: 'Ananya Iyer',
    paymentMethod: 'wallet',
    subtotal: 1599,
    discount: 50,
    gst: 278.82,
    total: 1827.82,
  },
];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toPreviewData(rows: ReportPreviewRow[]): ReportPreviewData {
  const totals = rows.reduce(
    (acc, row) => {
      acc.subtotal += row.subtotal;
      acc.discount += row.discount;
      acc.gst += row.gst;
      acc.total += row.total;
      return acc;
    },
    { subtotal: 0, discount: 0, gst: 0, total: 0 },
  );

  return {
    rows,
    totals: {
      subtotal: round2(totals.subtotal),
      discount: round2(totals.discount),
      gst: round2(totals.gst),
      total: round2(totals.total),
    },
  };
}

export const getMockAdminDashboard = (range: DateRange): AdminDashboardData => {
  return mockAdminDashboardByRange[range] ?? mockAdminDashboardByRange.monthly;
};

export const getMockReportPreview = (_range: DateRange, branch?: string): ReportPreviewData => {
  const filtered = branch
    ? mockReportRows.filter((_, index) => index % 2 === 0)
    : mockReportRows;
  return toPreviewData(filtered);
};

export const getMockOperatorDashboard = (): OperatorDashboardData => ({
  todayTotal: 182450,
  billCount: 68,
  averageBillValue: 2683.09,
  itemsSoldCount: 241,
  paymentBreakdown: [
    { method: 'card', total: 70120, billCount: 25 },
    { method: 'upi', total: 62400, billCount: 24 },
    { method: 'cash', total: 41130, billCount: 15 },
    { method: 'wallet', total: 8810, billCount: 4 },
  ],
  recentSales: [
    {
      docEntry: 1551,
      docNum: 100521,
      docDate: '2026-04-27',
      customerName: 'Walk-in Customer',
      paymentMethod: 'card',
      subtotal: 4298,
      discount: 200,
      gst: 737.64,
      total: 4835.64,
      items: [
        { itemCode: 'ELA-SB-BLK-001', itemName: 'Sports Bra - Black', quantity: 2, unitPrice: 1499, lineTotal: 2998 },
        { itemCode: 'ELA-NPEB-WHT-001', itemName: 'Non Padded Encircle Bra - White', quantity: 1, unitPrice: 1699, lineTotal: 1699 },
      ],
    },
    {
      docEntry: 1552,
      docNum: 100522,
      docDate: '2026-04-27',
      customerName: 'Priya Shah',
      paymentMethod: 'upi',
      subtotal: 3398,
      discount: 100,
      gst: 593.64,
      total: 3891.64,
      items: [
        { itemCode: 'ELA-PTB-NUD-001', itemName: 'Padded T-Shirt Bra - Nude', quantity: 1, unitPrice: 1899, lineTotal: 1899 },
        { itemCode: 'ELA-CPWL-BLK-001', itemName: 'Camisole Padded Without Lace - Black', quantity: 1, unitPrice: 1299, lineTotal: 1299 },
      ],
    },
  ],
  topSellingItems: [
    { itemCode: 'ELA-PTB-NUD-001', itemName: 'Padded T-Shirt Bra - Nude', quantity: 14, revenue: 26586 },
    { itemCode: 'ELA-SB-BLK-001', itemName: 'Sports Bra - Black', quantity: 12, revenue: 17988 },
    { itemCode: 'ELA-NPEB-WHT-001', itemName: 'Non Padded Encircle Bra - White', quantity: 10, revenue: 16990 },
  ],
  lowSellingItems: [
    { itemCode: 'ELA-BS-NN2-001', itemName: 'Boy Shorts - Navy & Nude (Pack of 2)', quantity: 1, revenue: 1199 },
    { itemCode: 'ELA-NPLC-GRY-001', itemName: 'Non Padded Lace Camisole - Grey', quantity: 1, revenue: 1399 },
    { itemCode: 'ELA-NPSSB-PPK-001', itemName: 'Non Padded Super Support Bra - Paradise Pink', quantity: 2, revenue: 3598 },
  ],
  availableStock: [
    { itemCode: 'ELA-SB-BLK-001', itemName: 'Sports Bra - Black', inStock: 45 },
    { itemCode: 'ELA-PTB-NUD-001', itemName: 'Padded T-Shirt Bra - Nude', inStock: 60 },
    { itemCode: 'ELA-NPEB-WHT-001', itemName: 'Non Padded Encircle Bra - White', inStock: 44 },
    { itemCode: 'ELA-CPWL-BLK-001', itemName: 'Camisole Padded Without Lace - Black', inStock: 58 },
  ],
  lowStockAlerts: [
    { itemCode: 'ELA-NPEB-PPK-001', itemName: 'Non Padded Encircle Bra - Paradise Pink', inStock: 3 },
    { itemCode: 'ELA-BS-NN2-001', itemName: 'Boy Shorts - Navy & Nude (Pack of 2)', inStock: 2 },
  ],
  outOfStockItems: [
    { itemCode: 'ELA-FBHRP-BPN3-001', itemName: 'Full Brief High Rise Panty - Black, Pink, Nude (Pack of 3)', inStock: 0 },
  ],
  returnedItems: [
    { itemCode: 'ELA-SB-BLK-001', itemName: 'Sports Bra - Black', quantity: 1 },
    { itemCode: 'ELA-PTB-LIL-001', itemName: 'Padded T-Shirt Bra - Lilac', quantity: 2 },
  ],
  returnsCount: 3,
  returnReasons: [
    { reason: 'size', count: 2 },
    { reason: 'defect', count: 1 },
  ],
  returnOrders: [
    {
      docEntry: 2101,
      docNum: 50123,
      docDate: '2026-04-27',
      customerName: 'Priya Shah',
      reason: 'Size issue',
      returnType: 'refund',
      items: [],
      refundAmount: 1899,
    },
    {
      docEntry: 2102,
      docNum: 50124,
      docDate: '2026-04-27',
      customerName: 'Walk-in Customer',
      reason: 'Defective product',
      returnType: 'exchange',
      items: [],
      refundAmount: 1299,
    },
  ],
  performance: {
    targetAmount: 50000,
    achievedAmount: 35240,
    targetBills: 30,
    achievedBills: 19,
    amountAchievementPercent: 70.48,
    billsAchievementPercent: 63.33,
  },
  customerInsights: mockCustomerInsights,
  quickActions: [
    { id: 'add-sale', label: 'Add Sale', path: '/pos' },
    { id: 'process-return', label: 'Process Return', path: '/returns' },
    { id: 'check-stock', label: 'Check Stock', path: '/products' },
  ],
});

// ============================================================================
// SALES HISTORY DATA (for future features)
// ============================================================================

export const mockSalesHistory: Sale[] = [
  {
    id: 'SALE-1738787401234',
    items: [
      { product: mockProducts[0], quantity: 3 },
      { product: mockProducts[8], quantity: 2 },
      { product: mockProducts[15], quantity: 1 },
    ],
    total: 16.00,
    timestamp: '2026-02-05T08:15:00Z',
  },
  {
    id: 'SALE-1738787402345',
    items: [
      { product: mockProducts[20], quantity: 1 },
      { product: mockProducts[8], quantity: 1 },
      { product: mockProducts[15], quantity: 1 },
    ],
    total: 10.00,
    timestamp: '2026-02-05T09:30:00Z',
  },
  {
    id: 'SALE-1738787403456',
    items: [
      { product: mockProducts[25], quantity: 6 },
      { product: mockProducts[26], quantity: 2 },
      { product: mockProducts[31], quantity: 3 },
    ],
    total: 24.47,
    timestamp: '2026-02-05T10:45:00Z',
  },
  {
    id: 'SALE-1738787404567',
    items: [
      { product: mockProducts[21], quantity: 1 },
      { product: mockProducts[23], quantity: 1 },
      { product: mockProducts[10], quantity: 1 },
    ],
    total: 26.48,
    timestamp: '2026-02-05T11:20:00Z',
  },
  {
    id: 'SALE-1738787405678',
    items: [
      { product: mockProducts[30], quantity: 2 },
      { product: mockProducts[31], quantity: 1 },
      { product: mockProducts[26], quantity: 4 },
    ],
    total: 14.48,
    timestamp: '2026-02-05T12:00:00Z',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Update mock dashboard summary (used when creating sales)
 */
export const updateMockSummary = (total: number) => {
  mockDashboardSummary = {
    todayTotal: mockDashboardSummary.todayTotal + total,
    billCount: mockDashboardSummary.billCount + 1,
    itemsSoldCount: mockDashboardSummary.itemsSoldCount,
  };
};

/**
 * Get mock dashboard summary
 */
export const getMockDashboardSummary = (): DashboardSummary => {
  return { ...mockDashboardSummary };
};

/**
 * Get all mock products
 */
export const getMockProducts = (): Product[] => {
  return [...mockProducts];
};

/**
 * Add new mock product
 */
export const addMockProduct = (product: Omit<Product, 'id'>): Product => {
  const newProduct: Product = {
    ...product,
    id: Date.now().toString(),
  };
  mockProducts.push(newProduct);
  return newProduct;
};

/**
 * Update mock product
 */
export const updateMockProduct = (id: string, product: Partial<Product>): Product => {
  const index = mockProducts.findIndex(p => p.id === id);
  if (index !== -1) {
    mockProducts[index] = { ...mockProducts[index], ...product };
    return mockProducts[index];
  }
  throw new Error('Product not found');
};

/**
 * Delete mock product
 */
export const deleteMockProduct = (id: string): void => {
  const index = mockProducts.findIndex(p => p.id === id);
  if (index !== -1) {
    mockProducts.splice(index, 1);
  }
};

/**
 * Get mock sales history
 */
export const getMockSalesHistory = (): Sale[] => {
  return [...mockSalesHistory];
};
