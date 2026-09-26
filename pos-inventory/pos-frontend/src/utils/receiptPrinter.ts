export interface ReceiptLineItem {
  name: string;
  quantity: number;
  amount: number;
  hsnCode?: string;
}

export interface ReceiptCustomerDetails {
  name?: string;
  phone?: string;
  email?: string;
  salesEmployee?: string;
}

export interface ReceiptTemplateData {
  saleId: string;
  items: ReceiptLineItem[];
  subtotal: number;
  discount: number;
  gst: number;
  gstPercentage?: number;
  total: number;
  paymentMethod: string;
  paidAmount?: number;
  changeAmount?: number;
  customer?: ReceiptCustomerDetails;
  timestamp?: string;
  logoSrc?: string;
}

const normalizeBaseUrl = (baseUrl: string) => {
  const withLeadingSlash = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
};

export const RECEIPT_LOGO_PATH = `${normalizeBaseUrl(import.meta.env.BASE_URL)}images/black-logo.png`;

const resolveLogoUrl = (logoPath: string) => {
  if (logoPath.startsWith('data:')) return logoPath;
  try {
    return new URL(logoPath, window.location.origin).toString();
  } catch {
    return logoPath;
  }
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const toWordsBelowThousand = (value: number): string => {
  const ones = [
    '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
  ];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  if (value === 0) return '';
  if (value < 20) return ones[value];
  if (value < 100) {
    const t = Math.floor(value / 10);
    const r = value % 10;
    return `${tens[t]}${r ? ` ${ones[r]}` : ''}`;
  }

  const h = Math.floor(value / 100);
  const r = value % 100;
  return `${ones[h]} hundred${r ? ` ${toWordsBelowThousand(r)}` : ''}`;
};

const amountToWordsINR = (amount: number): string => {
  const safeAmount = Math.max(0, Number.isFinite(amount) ? amount : 0);
  const rounded = Math.round(safeAmount * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  if (rupees === 0) {
    return paise > 0 ? `zero rupees and ${toWordsBelowThousand(paise)} paise only` : 'zero rupees only';
  }

  const parts: string[] = [];
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const last = rupees % 1000;

  if (crore) parts.push(`${toWordsBelowThousand(crore)} crore`);
  if (lakh) parts.push(`${toWordsBelowThousand(lakh)} lakh`);
  if (thousand) parts.push(`${toWordsBelowThousand(thousand)} thousand`);
  if (last) parts.push(toWordsBelowThousand(last));

  const rupeesText = `${parts.join(' ')} rupees`;
  if (paise > 0) {
    return `${rupeesText} and ${toWordsBelowThousand(paise)} paise only`;
  }
  return `${rupeesText} only`;
};

export const getReceiptLogoDataUrl = async (logoPath = RECEIPT_LOGO_PATH): Promise<string> => {
  const resolvedPath = resolveLogoUrl(logoPath);
  try {
    const response = await fetch(resolvedPath, { cache: 'force-cache' });
    if (!response.ok) {
      return resolvedPath;
    }

    const logoBlob = await response.blob();
    const fileReader = new FileReader();

    return await new Promise<string>((resolve, reject) => {
      fileReader.onloadend = () => resolve(String(fileReader.result || resolvedPath));
      fileReader.onerror = () => reject(new Error('Failed to read receipt logo'));
      fileReader.readAsDataURL(logoBlob);
    });
  } catch {
    return resolvedPath;
  }
};

export const buildReceiptDocument = ({
  saleId,
  items,
  subtotal,
  discount,
  gst,
  gstPercentage,
  total,
  paymentMethod,
  paidAmount,
  changeAmount,
  customer,
  timestamp,
  logoSrc,
}: ReceiptTemplateData): string => {
  const cgst = gst > 0 ? gst / 2 : 0;
  const sgst = gst > 0 ? gst / 2 : 0;
  const gstLabel = gstPercentage ? `(${gstPercentage / 2}%)` : '';
  const invoiceTime = timestamp || new Date().toLocaleString();
  const totalInWords = amountToWordsINR(total);
  const resolvedLogoSrc = resolveLogoUrl(logoSrc?.trim() || RECEIPT_LOGO_PATH);

  const lineItems = items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${item.quantity}</td>
          <td>${escapeHtml(item.hsnCode || 'N/A')}</td>
          <td class="text-right">₹${item.amount.toFixed(2)}</td>
        </tr>`
    )
    .join('');

  const customerSection = customer?.name?.trim()
    ? `
      <div class="customer-block">
        <p class="customer-title">Customer Details</p>
        <p class="customer-text">${escapeHtml(customer.name)}</p>
        ${customer.phone ? `<p class="customer-text">${escapeHtml(customer.phone)}</p>` : ''}
        ${customer.email ? `<p class="customer-text">${escapeHtml(customer.email)}</p>` : ''}
        ${customer.salesEmployee ? `<p class="customer-text">Sales Employee: ${escapeHtml(customer.salesEmployee)}</p>` : ''}
      </div>`
    : '';

  const discountRow = discount > 0
    ? `<div class="summary-row discount"><span>Discount</span><span>-₹${discount.toFixed(2)}</span></div>`
    : '';

  const paymentType = (paymentMethod || 'cash').toLowerCase();
  const paymentLabel = paymentType.toUpperCase();
  const paidAmountValue = Number.isFinite(paidAmount) ? Number(paidAmount) : total;
  const changeValue = Math.max(0, Number(changeAmount || 0));

  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt ${escapeHtml(saleId)}</title>
        <style>
          :root { color-scheme: light; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 14px;
            background: #ffffff;
            color: #1f2937;
            font-family: 'Segoe UI', Arial, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .receipt-shell { width: 100%; max-width: 420px; margin: 0 auto; }
          .receipt-card {
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            padding: 20px;
            background: #ffffff;
          }
          .company-header {
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 2px solid #d1d5db;
            text-align: center;
          }
          .receipt-logo {
            width: 120px;
            max-width: 70%;
            height: auto;
            margin: 0 auto 8px;
            display: block;
          }
          .company-name {
            margin: 0;
            font-size: 15px;
            font-weight: 800;
            letter-spacing: 0.2px;
          }
          .company-line {
            margin: 3px 0 0;
            font-size: 11px;
            color: #374151;
            line-height: 1.35;
          }
          .invoice-title {
            margin: 10px 0 0;
            font-size: 14px;
            font-weight: 600;
            text-decoration: underline;
          }
          .invoice-meta {
            margin: 10px 0 12px;
            font-size: 12px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 8px;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
          }
          .meta-row:last-child { margin-bottom: 0; }
          .meta-label { color: #6b7280; }
          .meta-value { font-weight: 600; color: #1f2937; }
          .items-table-wrap {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 12px;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          .items-table thead { background: #f9fafb; }
          .items-table th,
          .items-table td {
            border-bottom: 1px solid #f3f4f6;
            padding: 6px;
            text-align: left;
          }
          .items-table th { font-weight: 700; color: #374151; }
          .text-right { text-align: right; }
          .customer-block {
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid #e5e7eb;
          }
          .customer-title { margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #374151; }
          .customer-text { margin: 2px 0; font-size: 13px; color: #4b5563; }
          .totals { border-top: 2px dashed #d1d5db; padding-top: 12px; }
          .summary-row {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            color: #4b5563;
            margin-bottom: 6px;
          }
          .summary-row span:last-child { font-weight: 600; }
          .discount { color: #dc2626; }
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 2px solid #d1d5db;
            padding-top: 10px;
            margin-top: 8px;
            font-size: 22px;
            font-weight: 700;
            color: #1f2937;
          }
          .total-amount { color: #ec4899; }
          .payment {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 2px dashed #d1d5db;
          }
          .amount-words {
            margin-top: 8px;
            font-size: 11px;
            color: #374151;
            border-radius: 6px;
            padding: 8px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
          }
          .amount-words span {
            font-weight: 700;
          }
          .change-row {
            display: flex;
            justify-content: space-between;
            margin-top: 8px;
            font-size: 13px;
            border-radius: 6px;
            padding: 8px;
            background: #f0fdf4;
          }
          .change-label { color: #15803d; font-weight: 600; }
          .change-value { color: #16a34a; font-size: 16px; font-weight: 700; }
          .terms {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 2px solid #d1d5db;
            font-size: 11px;
            color: #374151;
            line-height: 1.45;
          }
          .terms h4 {
            margin: 0 0 6px;
            font-size: 12px;
            font-weight: 700;
          }
          .terms ul {
            margin: 0;
            padding-left: 16px;
          }
          .terms li { margin-bottom: 3px; }
          .compliance {
            margin-top: 8px;
            border-top: 1px dashed #d1d5db;
            padding-top: 8px;
          }
          .compliance p {
            margin: 0 0 4px;
            font-weight: 700;
          }
          .closing {
            margin-top: 8px;
            text-align: center;
            font-weight: 700;
            font-size: 11px;
          }
          @page { size: auto; margin: 8mm; }
        </style>
      </head>
      <body>
        <div class="receipt-shell">
          <div class="receipt-card">
            <div class="company-header">
              <img class="receipt-logo" src="${resolvedLogoSrc}" alt="CMCS Logo" />
              <h3 class="company-name">CMCS INDIA PRIVATE LIMITED</h3>
              <p class="company-line">Basement Floor, Shop No 7, Jai Govind Plaza, Hedgewar Road,</p>
              <p class="company-line">Shagun Chowk,Pimpri, Pimpri Chinchwad, Pune, Maharashtra 411017</p>
              <p class="company-line">CIN NO: U72900MH1992PTC066264</p>
              <p class="company-line">GSTN: 27AAACC0644D1Z8</p>
              <p class="invoice-title">TAX INVOICE</p>
            </div>

            <div class="invoice-meta">
              <div class="meta-row"><span class="meta-label">Serial Number</span><span class="meta-value">${escapeHtml(saleId)}</span></div>
              <div class="meta-row"><span class="meta-label">Invoice Date & Time</span><span class="meta-value">${escapeHtml(invoiceTime)}</span></div>
              <div class="meta-row"><span class="meta-label">Payment Method</span><span class="meta-value">${escapeHtml(paymentLabel)}</span></div>
            </div>

            ${customerSection}

            <div class="items-table-wrap">
              <table class="items-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>HSN Code</th>
                    <th class="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${lineItems}
                </tbody>
              </table>
            </div>

            <div class="totals">
              <div class="summary-row"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
              ${discountRow}
              ${gst > 0 ? `<div class="summary-row"><span>CGST ${gstLabel}</span><span>+₹${cgst.toFixed(2)}</span></div>` : ''}
              ${gst > 0 ? `<div class="summary-row"><span>SGST ${gstLabel}</span><span>+₹${sgst.toFixed(2)}</span></div>` : ''}
              <div class="total-row"><span>TOTAL</span><span class="total-amount">₹${total.toFixed(2)}</span></div>
            </div>
            <div class="payment">
              ${paymentType === 'cash' ? `<div class="summary-row"><span>Paid</span><span>₹${paidAmountValue.toFixed(2)}</span></div>` : ''}
              ${paymentType === 'cash' && changeValue > 0 ? `<div class="change-row"><span class="change-label">Change to Return</span><span class="change-value">₹${changeValue.toFixed(2)}</span></div>` : ''}
              <div class="amount-words"><span>Total (in words):</span> ${escapeHtml(totalInWords)}</div>
            </div>

            <div class="terms">
              <h4>Terms & Conditions</h4>
              <ul>
                <li>No exchange/returns on innerwear, active wear, socks, cosmetics, or altered garments for hygiene reasons.</li>
                <li>Customers are requested to inspect the merchandise thoroughly before payment. The store is not responsible for physical damages/stains identified after leaving the premises.</li>
                <li>JURISDICTION: All disputes are subject to MUMBAI jurisdiction.</li>
                <li>Customer Service Email: ______</li>
                <li>This is a computer-generated invoice and does not require a physical signature.</li>
                <li>E.&O.E.: Errors and Omissions Excepted.</li>
                <li>Goods sold under valid bill only; please retain this invoice for future reference.</li>
              </ul>
              <div class="closing">
                <div>*** Thank You for Shopping with CMCS! ***</div>
                <div>*** VISIT AGAIN! ***</div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>`;
};

export const printReceiptInBrowser = async (receiptDocument: string): Promise<void> => {
  const printWindow = window.open('', '_blank', 'width=420,height=760');
  if (!printWindow) {
    throw new Error('Print window was blocked by the browser. Please allow pop-ups and try again.');
  }

  printWindow.document.open();
  printWindow.document.write(receiptDocument);
  printWindow.document.close();
  printWindow.focus();

  await new Promise<void>((resolve) => {
    const loadedImages = Array.from(printWindow.document.images).filter((image) => !image.complete);
    if (loadedImages.length === 0) {
      resolve();
      return;
    }

    let pending = loadedImages.length;
    const onDone = () => {
      pending -= 1;
      if (pending <= 0) {
        resolve();
      }
    };

    loadedImages.forEach((image) => {
      image.addEventListener('load', onDone, { once: true });
      image.addEventListener('error', onDone, { once: true });
    });

    window.setTimeout(resolve, 1200);
  });

  printWindow.print();

  window.setTimeout(() => {
    printWindow.close();
  }, 400);
};
