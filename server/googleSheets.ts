import { google } from "googleapis";

/**
 * Google Sheets integration using Service Account credentials.
 *
 * The service account JSON key is stored in the GOOGLE_SERVICE_ACCOUNT_KEY env var.
 * The user must share their Google Sheet with the service account email address.
 */

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

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return auth;
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
 * Append a row of data to a Google Sheet.
 * Finds the next empty row and writes the data.
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

    // The columns in the sheet are:
    // A: Week | B: Date | C: Day | D: Weight (kg) | E: Weight avg | F: Steps
    // G: Calories (kcal) | H: Protein (g) | I: (hidden) | J: Training Day | K: (hidden) | L: (hidden) | M: Comments | N: Meals
    //
    // We auto-fill: B (Date), C (Day), G (Calories), H (Protein), N (Meals)
    // The rest are left empty for the user/PT to fill manually.

    const values = [
      [
        "", // A: Week (manual)
        rowData.date, // B: Date
        rowData.day, // C: Day
        "", // D: Weight (manual)
        "", // E: Weight avg (manual)
        "", // F: Steps (manual)
        rowData.calories, // G: Calories
        rowData.protein, // H: Protein
        "", // I: (hidden/unknown)
        "", // J: Training Day (manual)
        "", // K: (hidden)
        "", // L: (hidden)
        "", // M: Comments (manual)
        rowData.meals, // N: Meals
      ],
    ];

    const range = `${sheetName}!A:N`;

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values,
      },
    });

    return {
      success: true,
      updatedRange: response.data.updates?.updatedRange ?? undefined,
    };
  } catch (err: any) {
    const message = err.message || "Unknown error writing to Google Sheets";

    // Provide helpful error messages
    if (message.includes("403") || message.includes("PERMISSION_DENIED")) {
      return {
        success: false,
        error:
          "Permission denied. Make sure you've shared the Google Sheet with the service account email address (as Editor).",
      };
    }
    if (message.includes("404") || message.includes("not found")) {
      return {
        success: false,
        error:
          "Spreadsheet not found. Please check the Google Sheets URL in your settings.",
      };
    }

    return { success: false, error: message };
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

    // First, try to find if a row with this date already exists (column B)
    const existingData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!B:B`,
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
      // Update existing row — only update columns G, H, and N (Calories, Protein, Meals)
      const updateRequests = [
        {
          range: `${sheetName}!G${existingRowIndex}`,
          values: [[rowData.calories]],
        },
        {
          range: `${sheetName}!H${existingRowIndex}`,
          values: [[rowData.protein]],
        },
        {
          range: `${sheetName}!N${existingRowIndex}`,
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
      const result = await appendRowToSheet(spreadsheetId, sheetName, rowData);
      return { ...result, action: "appended" };
    }
  } catch (err: any) {
    const message = err.message || "Unknown error";

    if (message.includes("403") || message.includes("PERMISSION_DENIED")) {
      return {
        success: false,
        error:
          "Permission denied. Make sure you've shared the Google Sheet with the service account email address (as Editor).",
      };
    }
    if (message.includes("404") || message.includes("not found")) {
      return {
        success: false,
        error:
          "Spreadsheet not found. Please check the Google Sheets URL in your settings.",
      };
    }

    return { success: false, error: message };
  }
}
