import { google } from "googleapis";

/**
 * Google Sheets integration using Service Account credentials.
 *
 * The service account JSON key is stored in the GOOGLE_SERVICE_ACCOUNT_KEY env var.
 * The user must share their Google Sheet with the service account email address.
 */

function fixPrivateKey(key: string): string {
  // Some storage systems strip spaces from PEM headers/footers.
  // e.g. "-----BEGINPRIVATEKEY-----" instead of "-----BEGIN PRIVATE KEY-----"
  // Normalize all known variants so Node's crypto can parse the key.
  return key
    .replace('-----BEGINPRIVATEKEY-----', '-----BEGIN PRIVATE KEY-----')
    .replace('-----ENDPRIVATEKEY-----', '-----END PRIVATE KEY-----')
    .replace(/-----BEGIN(\w+)KEY-----/g, '-----BEGIN $1 KEY-----')
    .replace(/-----END(\w+)KEY-----/g, '-----END $1 KEY-----')
    .replace('BEGIN PRIVATE  KEY', 'BEGIN PRIVATE KEY')
    .replace('END PRIVATE  KEY', 'END PRIVATE KEY');
}

function getAuthClient() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    throw new Error(
      "Google Service Account key not configured. Please add GOOGLE_SERVICE_ACCOUNT_KEY in Settings."
    );
  }

  let credentials: any;
  try {
    credentials = JSON.parse(keyJson);
  } catch {
    throw new Error("Invalid Google Service Account key format. Must be valid JSON.");
  }

  if (credentials.private_key) {
    credentials.private_key = fixPrivateKey(credentials.private_key);
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return auth;
}

/**
 * Quote a sheet name for use in A1 notation.
 * Sheet names with spaces or special characters must be wrapped in single quotes.
 */
function quoteSheetName(name: string): string {
  // If the name contains spaces or special chars, wrap in single quotes
  // and escape any existing single quotes by doubling them.
  if (/[\s'!]/.test(name) || name.includes("'")) {
    return `'${name.replace(/'/g, "''")}'`;
  }
  return name;
}

/**
 * Extract the service account email from the stored credentials.
 */
export function getServiceAccountEmail(): string | null {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) return null;
  try {
    const creds = JSON.parse(keyJson);
    return creds.client_email || null;
  } catch {
    return null;
  }
}

/**
 * Auto-detect the first sheet tab name in the spreadsheet.
 * Falls back to the provided name if detection fails.
 */
async function resolveSheetName(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  userSheetName: string
): Promise<string> {
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties.title",
    });
    const titles = meta.data.sheets?.map((s) => s.properties?.title).filter(Boolean) as string[];
    if (!titles || titles.length === 0) return userSheetName;

    // If the user-provided name matches one of the tabs, use it
    if (titles.includes(userSheetName)) return userSheetName;

    // Otherwise, try a case-insensitive match
    const lower = userSheetName.toLowerCase();
    const match = titles.find((t) => t.toLowerCase() === lower);
    if (match) return match;

    // Fall back to the first sheet tab
    return titles[0];
  } catch {
    return userSheetName;
  }
}

/**
 * Append a row of data to a Google Sheet.
 */
export async function appendRowToSheet(
  spreadsheetId: string,
  sheetName: string,
  rowData: {
    date: string;
    day: string;
    calories: number;
    protein: number;
    meals: string;
  }
): Promise<{ success: boolean; updatedRange?: string; error?: string }> {
  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });

    // Resolve the actual sheet tab name
    const resolvedName = await resolveSheetName(sheets, spreadsheetId, sheetName);
    const quoted = quoteSheetName(resolvedName);

    // Columns: A:Week B:Date C:Day D:Weight E:WeightAvg F:Steps
    //          G:Calories H:Protein I-L:(hidden) M:Comments N:Meals
    // We auto-fill: B, C, G, H, N
    const values = [
      [
        "",               // A: Week (manual)
        rowData.date,     // B: Date
        rowData.day,      // C: Day
        "",               // D: Weight (manual)
        "",               // E: Weight avg (manual)
        "",               // F: Steps (manual)
        rowData.calories, // G: Calories
        rowData.protein,  // H: Protein
        "",               // I
        "",               // J: Training Day (manual)
        "",               // K
        "",               // L
        "",               // M: Comments (manual)
        rowData.meals,    // N: Meals
      ],
    ];

    const range = `${quoted}!A:N`;

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });

    return {
      success: true,
      updatedRange: response.data.updates?.updatedRange ?? undefined,
    };
  } catch (err: any) {
    return { success: false, error: friendlyError(err) };
  }
}

/**
 * Find an existing row for a given date and update it, or append a new row.
 */
export async function syncRowToSheet(
  spreadsheetId: string,
  sheetName: string,
  rowData: {
    date: string;
    day: string;
    calories: number;
    protein: number;
    meals: string;
  }
): Promise<{ success: boolean; updatedRange?: string; error?: string; action?: string }> {
  try {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });

    // Resolve the actual sheet tab name
    const resolvedName = await resolveSheetName(sheets, spreadsheetId, sheetName);
    const quoted = quoteSheetName(resolvedName);

    // Check if a row with this date already exists (column B)
    const existingData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${quoted}!B:B`,
    });

    const rows = existingData.data.values || [];
    let existingRowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === rowData.date) {
        existingRowIndex = i + 1; // 1-indexed
        break;
      }
    }

    if (existingRowIndex > 0) {
      // Update existing row — only update columns G, H, and N
      const updateRequests = [
        {
          range: `${quoted}!G${existingRowIndex}`,
          values: [[rowData.calories]],
        },
        {
          range: `${quoted}!H${existingRowIndex}`,
          values: [[rowData.protein]],
        },
        {
          range: `${quoted}!N${existingRowIndex}`,
          values: [[rowData.meals]],
        },
      ];

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: updateRequests,
        },
      });

      return {
        success: true,
        updatedRange: `Row ${existingRowIndex}`,
        action: "updated",
      };
    } else {
      // Append new row
      const result = await appendRowToSheet(spreadsheetId, resolvedName, rowData);
      return { ...result, action: "appended" };
    }
  } catch (err: any) {
    return { success: false, error: friendlyError(err) };
  }
}

/** Turn API errors into user-friendly messages. */
function friendlyError(err: any): string {
  const message = err.message || "Unknown error writing to Google Sheets";

  if (message.includes("403") || message.includes("PERMISSION_DENIED")) {
    return "Permission denied. Make sure you've shared the Google Sheet with the service account email address (as Editor).";
  }
  if (message.includes("404") || message.includes("not found")) {
    return "Spreadsheet not found. Please check the Google Sheets URL in your settings.";
  }
  if (message.includes("Unable to parse range")) {
    return "Invalid sheet tab name. Please check the Sheet Tab Name in your settings matches an actual tab in your spreadsheet.";
  }
  if (message.includes("DECODER") || message.includes("unsupported")) {
    return "Service account key format error. Please re-upload your Google Service Account JSON key.";
  }

  return message;
}
