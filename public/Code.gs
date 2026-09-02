function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Edafter workspace')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

const SETTINGS_SHEET = 'DB';
const DRIVE_FOLDER_ID = '1Sbcjz2kEZhPNSGbIAqzGmpjd7Xi8V5EN';

function getCompanySettings() {
  const record = new SheetORM(SETTINGS_SHEET).findOne({});
  const saved = normalizeSettings(record || {});
  let signatories = [];
  try {
    signatories = JSON.parse(saved['Signatories'] || '[]');
  } catch (error) {
    signatories = [];
  }
  return {
    companyName: saved['Company Name'],
    companyAddress: saved['Company Address'],
    PAN: saved.PAN,
    GST: saved.GST,
    MSME: saved.MSME,
    letterheadUrl: saved['Letterhead URL'],
    marginLeft: saved['Margin Left'],
    marginTop: saved['Margin Top'],
    marginRight: saved['Margin Right'],
    marginBottom: saved['Margin Bottom'],
    defaultSignatoryIndex: Number(saved['Default Signatory Index'] !== undefined ? saved['Default Signatory Index'] : 0),
    signatories: signatories
  };
}

function saveCompanySettings(settings) {
  const db = new SheetORM(SETTINGS_SHEET);
  const current = db.findOne({});
  const changes = normalizeSettings(settings || {});

  if (current) {
    const firstHeader = Object.keys(current)[0];
    db.update({ [firstHeader]: current[firstHeader] }, changes);
  } else {
    db.insert(changes);
  }

  return getCompanySettings();
}

function uploadCompanyFile(file) {
  if (!file || !file.data || !file.name || !file.mimeType) {
    throw new Error('A file name, MIME type, and base64 data are required.');
  }

  if (['image/png', 'image/jpeg'].indexOf(file.mimeType) === -1) {
    throw new Error('Only PNG and JPG files are supported.');
  }

  const bytes = Utilities.base64Decode(file.data);
  const blob = Utilities.newBlob(bytes, file.mimeType, file.name);
  const driveFile = DriveApp.getFolderById(DRIVE_FOLDER_ID).createFile(blob);
  driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return `https://lh3.googleusercontent.com/d/${driveFile.getId()}`;
}

function normalizeSettings(settings) {
  let signatoriesStr = '[]';
  if (typeof settings['Signatories'] === 'string') {
    signatoriesStr = settings['Signatories'];
  } else if (typeof settings.signatories === 'string') {
    signatoriesStr = settings.signatories;
  } else if (Array.isArray(settings.signatories)) {
    signatoriesStr = JSON.stringify(settings.signatories);
  }

  return {
    'Company Name': settings['Company Name'] || settings.companyName || '',
    'Company Address': settings['Company Address'] || settings.companyAddress || '',
    PAN: settings.PAN || '',
    GST: settings.GST || '',
    MSME: settings.MSME || '',
    'Letterhead URL': settings['Letterhead URL'] || settings.letterheadUrl || '',
    'Margin Left': Number(settings['Margin Left'] !== undefined ? settings['Margin Left'] : (settings.marginLeft || 0)),
    'Margin Top': Number(settings['Margin Top'] !== undefined ? settings['Margin Top'] : (settings.marginTop || 0)),
    'Margin Right': Number(settings['Margin Right'] !== undefined ? settings['Margin Right'] : (settings.marginRight || 0)),
    'Margin Bottom': Number(settings['Margin Bottom'] !== undefined ? settings['Margin Bottom'] : (settings.marginBottom || 0)),
    'Default Signatory Index': Number(settings['Default Signatory Index'] !== undefined ? settings['Default Signatory Index'] : (settings.defaultSignatoryIndex || 0)),
    'Signatories': signatoriesStr,
  };
}

const TEMPLATES_SHEET = 'Templates';

function getTemplates() {
  const db = new SheetORM(TEMPLATES_SHEET, { autoCreate: true });
  const records = db.all();
  return records
    .filter(r => {
      const vis = r.Visible !== undefined ? String(r.Visible).toUpperCase() : 'TRUE';
      return vis !== 'FALSE';
    })
    .map(r => ({
      id: String(r.Id || r.id || ''),
      createdOn: String(r['Created On'] || r.createdOn || ''),
      name: String(r.Name || r.name || ''),
      description: String(r.Description || r.description || ''),
      content: String(r.Content || r.content || ''),
      variables: String(r.Variables || r.variables || '[]'),
      visible: String(r.Visible !== undefined ? r.Visible : 'TRUE'),
    }));
}

function saveTemplate(template) {
  const db = new SheetORM(TEMPLATES_SHEET, { autoCreate: true });

  // If editing existing template, mark the old record as Visible = FALSE
  if (template.oldId) {
    const existing = db.findOne({ Id: template.oldId });
    if (existing) {
      db.update({ Id: template.oldId }, { Visible: 'FALSE' });
    }
  }

  // Insert updated template as a brand new record with a new ID
  const newRecord = {
    Id: Utilities.getUuid(),
    'Created On': new Date().toISOString(),
    Name: template.name || '',
    Description: template.description || '',
    Content: template.content || '',
    Variables: typeof template.variables === 'string' ? template.variables : JSON.stringify(template.variables || []),
    Visible: 'TRUE',
  };

  db.insert(newRecord);
  return getTemplates();
}

function deleteTemplate(id) {
  const db = new SheetORM(TEMPLATES_SHEET, { autoCreate: true });
  const existing = db.findOne({ Id: id });
  if (existing) {
    db.update({ Id: id }, { Visible: 'FALSE' });
  }
  return getTemplates();
}

const DOCUMENTS_SHEET = 'Documents';

function getDocuments() {
  const db = new SheetORM(DOCUMENTS_SHEET, { autoCreate: true });
  const records = db.all();
  const docs = records.map(function(r) {
    return {
      sNo: String(r['S No'] || ''),
      createdOn: String(r['Created On'] || ''),
      templateId: String(r['Template Id'] || ''),
      title: String(r['Title'] || ''),
      variableValues: String(r['Variable Values'] || '{}'),
      pdfUrl: String(r['Pdf Url'] || ''),
      content: String(r['Content'] || r.content || ''),
    };
  });

  // Sort by Created On descending by default
  docs.sort(function(a, b) {
    var dA = new Date(a.createdOn).getTime() || 0;
    var dB = new Date(b.createdOn).getTime() || 0;
    return dB - dA;
  });

  return docs;
}

function saveDocument(doc) {
  const db = new SheetORM(DOCUMENTS_SHEET, { autoCreate: true });
  var allRecords = db.all();
  var nextSNo = allRecords.length + 1;

  var record = {
    'S No': doc.sNo || String(nextSNo),
    'Created On': doc.createdOn || new Date().toISOString(),
    'Template Id': doc.templateId || '',
    'Title': doc.title || '',
    'Variable Values': typeof doc.variableValues === 'string' ? doc.variableValues : JSON.stringify(doc.variableValues || {}),
    'Pdf Url': doc.pdfUrl || '',
    'Content': doc.content || '',
  };

  var existing = db.findOne({ 'S No': record['S No'] });
  if (existing) {
    db.update({ 'S No': record['S No'] }, record);
  } else {
    db.insert(record);
  }
  return getDocuments();
}

function deleteDocument(sNo) {
  const db = new SheetORM(DOCUMENTS_SHEET, { autoCreate: true });
  var targetStr = String(sNo).trim();
  const { records, rowNumbers } = db._readAll();
  const rowsToDelete = [];
  records.forEach(function(r, i) {
    var cellVal = String(r['S No'] !== undefined && r['S No'] !== null ? r['S No'] : (r.sNo !== undefined ? r.sNo : '')).trim();
    if (cellVal === targetStr) {
      rowsToDelete.push(rowNumbers[i]);
    }
  });

  rowsToDelete
    .sort(function(a, b) { return b - a; })
    .forEach(function(rowNum) { db.sheet.deleteRow(rowNum); });

  return getDocuments();
}

function savePdfToDrive(payload) {
  if (!payload || !payload.data || !payload.name) {
    throw new Error('PDF data and filename are required.');
  }

  var bytes = Utilities.base64Decode(payload.data);
  var blob = Utilities.newBlob(bytes, 'application/pdf', payload.name);
  var driveFile = DriveApp.getFolderById(DRIVE_FOLDER_ID).createFile(blob);
  driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    url: 'https://drive.google.com/file/d/' + driveFile.getId() + '/view',
    id: driveFile.getId(),
  };
}