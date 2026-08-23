export type Portion = "half" | "full";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  available: boolean;
  isVeg: boolean;
  imageUrl?: string;
  hasPortions: boolean;
  halfPrice?: number;
  fullPrice?: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderLineItem {
  menuItemId: string;
  name: string;
  portion?: Portion;
  price: number;
  quantity: number;
  lineTotal: number;
}

export type DiscountType = "none" | "percent" | "flat";
export type OrderType = "dine-in" | "delivery";
export type DeliveryStatus = "pending" | "out_for_delivery" | "delivered" | "cancelled";

export interface Order {
  id: string;
  billNumber: number;
  items: OrderLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  deliveryCharge: number;
  total: number;
  customerName?: string;
  tableNumber?: string;
  orderType: OrderType;
  phone?: string;
  deliveryAddress?: string;
  deliveryStatus?: DeliveryStatus;
  paymentMethod: "cash" | "card" | "upi" | "other";
  createdAt: string;
}

export interface Database {
  menuItems: MenuItem[];
  orders: Order[];
  nextBillNumber: number;
}
