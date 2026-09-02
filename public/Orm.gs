/**
 * SheetORM.gs
 * A lightweight ORM-style wrapper for Google Sheets (Active Spreadsheet).
 *
 * Treats each Sheet as a "table". The first row of each sheet is
 * treated as the column/field names. Each subsequent row becomes a
 * record (plain JS object) with those fields as keys.
 *
 * USAGE EXAMPLES (see bottom of file):
 *   const Users = new SheetORM('Users');
 *   Users.all();
 *   Users.find({ status: 'active' });
 *   Users.findOne({ id: 5 });
 *   Users.insert({ name: 'Alice', status: 'active' });
 *   Users.update({ id: 5 }, { status: 'inactive' });
 *   Users.delete({ id: 5 });
 *   Users.count({ status: 'active' });
 */

class SheetORM {
  /**
   * @param {string} sheetName - Name of the sheet/tab to treat as a table.
   * @param {Object} [options]
   * @param {number} [options.headerRow=1] - Row number containing field names.
   * @param {boolean} [options.autoCreate=false] - Create the sheet if missing.
   */
  constructor(sheetName, options = {}) {
    this.sheetName = sheetName;
    this.headerRow = options.headerRow || 1;
    this.ss = SpreadsheetApp.getActiveSpreadsheet();
    this.sheet = this.ss.getSheetByName(sheetName);

    if (!this.sheet) {
      if (options.autoCreate) {
        this.sheet = this.ss.insertSheet(sheetName);
      } else {
        throw new Error(`SheetORM: sheet "${sheetName}" does not exist.`);
      }
    }

    this._headers = null; // lazy-loaded cache of column headers
  }

  // ---------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------

  /** Returns the header/field names as an array, cached per instance. */
  _getHeaders() {
    if (!this._headers) {
      const lastCol = this.sheet.getLastColumn();
      if (lastCol === 0) {
        this._headers = [];
      } else {
        this._headers = this.sheet
          .getRange(this.headerRow, 1, 1, lastCol)
          .getValues()[0]
          .map(h => String(h).trim());
      }
    }
    return this._headers;
  }

  /** Forces headers to be re-read on next access (call after schema changes). */
  refreshSchema() {
    this._headers = null;
  }

  /**
   * Reads all data rows (excluding header) and returns:
   *   { records: [{...}], rowNumbers: [sheetRowNum, ...] }
   * rowNumbers lets update/delete map a record back to its physical row.
   */
  _readAll() {
    const headers = this._getHeaders();
    const firstDataRow = this.headerRow + 1;
    const lastRow = this.sheet.getLastRow();

    if (lastRow < firstDataRow || headers.length === 0) {
      return { records: [], rowNumbers: [] };
    }

    const numRows = lastRow - firstDataRow + 1;
    const values = this.sheet
      .getRange(firstDataRow, 1, numRows, headers.length)
      .getValues();

    const records = [];
    const rowNumbers = [];

    values.forEach((row, i) => {
      // Skip fully blank rows
      const isBlank = row.every(cell => cell === '' || cell === null);
      if (isBlank) return;

      const record = {};
      headers.forEach((h, colIdx) => {
        if (h) record[h] = row[colIdx];
      });
      records.push(record);
      rowNumbers.push(firstDataRow + i);
    });

    return { records, rowNumbers };
  }

  /**
   * Checks whether a record matches a conditions object.
   * Supports plain equality, and operator objects, e.g.:
   *   { age: { gt: 18 } }, { age: { gte, lt, lte, ne } }, { name: { contains: 'al' } }
   */
  _matches(record, conditions) {
    if (!conditions) return true;
    return Object.keys(conditions).every(field => {
      const expected = conditions[field];
      const actual = record[field];

      if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
        return Object.keys(expected).every(op => {
          const val = expected[op];
          switch (op) {
            case 'eq': return actual === val;
            case 'ne': return actual !== val;
            case 'gt': return actual > val;
            case 'gte': return actual >= val;
            case 'lt': return actual < val;
            case 'lte': return actual <= val;
            case 'contains':
              return String(actual).toLowerCase().includes(String(val).toLowerCase());
            case 'in':
              return Array.isArray(val) && val.includes(actual);
            default:
              throw new Error(`SheetORM: unknown operator "${op}"`);
          }
        });
      }

      return actual === expected;
    });
  }

  // ---------------------------------------------------------------------
  // Public query API
  // ---------------------------------------------------------------------

  /** Returns all records as an array of objects. */
  all() {
    return this._readAll().records;
  }

  /** Returns records matching the given conditions object. */
  find(conditions = {}) {
    return this._readAll().records.filter(r => this._matches(r, conditions));
  }

  /** Returns the first record matching the conditions, or null. */
  findOne(conditions = {}) {
    const { records } = this._readAll();
    return records.find(r => this._matches(r, conditions)) || null;
  }

  /** Returns the count of records matching the conditions. */
  count(conditions = {}) {
    return this.find(conditions).length;
  }

  // ---------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------

  /**
   * Inserts one record (object) or an array of records.
   * Missing fields are left blank; unknown fields are ignored
   * unless they match an existing header.
   */
  insert(data) {
    const headers = this._getHeaders();
    if (headers.length === 0) {
      throw new Error('SheetORM: cannot insert, sheet has no header row.');
    }
    const records = Array.isArray(data) ? data : [data];

    const rows = records.map(record =>
      headers.map(h => (record.hasOwnProperty(h) ? record[h] : ''))
    );

    this.sheet
      .getRange(this.sheet.getLastRow() + 1, 1, rows.length, headers.length)
      .setValues(rows);

    return records.length;
  }

  /**
   * Updates all records matching `conditions` with fields in `changes`.
   * Returns the number of rows updated.
   */
  update(conditions, changes) {
    const headers = this._getHeaders();
    const { records, rowNumbers } = this._readAll();
    let updatedCount = 0;

    records.forEach((record, i) => {
      if (this._matches(record, conditions)) {
        const rowNum = rowNumbers[i];
        Object.keys(changes).forEach(field => {
          const colIdx = headers.indexOf(field);
          if (colIdx !== -1) {
            this.sheet.getRange(rowNum, colIdx + 1).setValue(changes[field]);
          }
        });
        updatedCount++;
      }
    });

    return updatedCount;
  }

  /**
   * Deletes all records matching `conditions`.
   * Returns the number of rows deleted.
   */
  delete(conditions) {
    const { records, rowNumbers } = this._readAll();
    const rowsToDelete = [];

    records.forEach((record, i) => {
      if (this._matches(record, conditions)) {
        rowsToDelete.push(rowNumbers[i]);
      }
    });

    // Delete from bottom to top so row numbers don't shift mid-loop.
    rowsToDelete
      .sort((a, b) => b - a)
      .forEach(rowNum => this.sheet.deleteRow(rowNum));

    return rowsToDelete.length;
  }

  /** Deletes every data row in the table, keeping the header. */
  truncate() {
    const lastRow = this.sheet.getLastRow();
    const firstDataRow = this.headerRow + 1;
    if (lastRow >= firstDataRow) {
      this.sheet.deleteRows(firstDataRow, lastRow - firstDataRow + 1);
    }
  }
}

// ---------------------------------------------------------------------
// Example usage (safe to delete)
// ---------------------------------------------------------------------

function exampleUsage() {
  // Assumes a sheet named "Users" with header row: id | name | status | age
  const Users = new SheetORM('Users');

  // Insert
  Users.insert({ id: 1, name: 'Alice', status: 'active', age: 30 });
  Users.insert([
    { id: 2, name: 'Bob', status: 'inactive', age: 22 },
    { id: 3, name: 'Carol', status: 'active', age: 41 },
  ]);

  // Query
  Logger.log(Users.all());
  Logger.log(Users.find({ status: 'active' }));
  Logger.log(Users.find({ age: { gte: 30 } }));
  Logger.log(Users.findOne({ id: 2 }));
  Logger.log(Users.count({ status: 'active' }));

  // Update
  Users.update({ id: 2 }, { status: 'active' });

  // Delete
  Users.delete({ id: 3 });
}