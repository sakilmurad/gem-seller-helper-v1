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

  let defIdx = 0;
  const foundIdx = signatories.findIndex(function(s) {
    return s && (s.isDefault === true || String(s.isDefault).toLowerCase() === 'true');
  });
  if (foundIdx !== -1) {
    defIdx = foundIdx;
  } else if (saved['Default Signatory Index'] !== undefined && saved['Default Signatory Index'] !== null) {
    defIdx = Number(saved['Default Signatory Index']);
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
    defaultSignatoryIndex: defIdx,
    signatories: signatories,
    geminiApiKey: saved['GEMINI_API_KEY'] || saved.geminiApiKey || '',
    geminiModelId: saved['MODEL_ID'] || saved.geminiModelId || 'gemini-2.5-flash'
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
  let signatoriesArr = [];
  if (typeof settings['Signatories'] === 'string') {
    signatoriesStr = settings['Signatories'];
    try { signatoriesArr = JSON.parse(signatoriesStr); } catch (e) {}
  } else if (typeof settings.signatories === 'string') {
    signatoriesStr = settings.signatories;
    try { signatoriesArr = JSON.parse(signatoriesStr); } catch (e) {}
  } else if (Array.isArray(settings.signatories)) {
    signatoriesArr = settings.signatories;
    signatoriesStr = JSON.stringify(settings.signatories);
  }

  let defIdx = 0;
  const foundIdx = signatoriesArr.findIndex(function(s) {
    return s && (s.isDefault === true || String(s.isDefault).toLowerCase() === 'true');
  });
  if (foundIdx !== -1) {
    defIdx = foundIdx;
  } else if (settings['Default Signatory Index'] !== undefined && settings['Default Signatory Index'] !== null) {
    defIdx = Number(settings['Default Signatory Index']);
  } else if (settings.defaultSignatoryIndex !== undefined && settings.defaultSignatoryIndex !== null) {
    defIdx = Number(settings.defaultSignatoryIndex);
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
    'Default Signatory Index': defIdx,
    'Signatories': signatoriesStr,
    'GEMINI_API_KEY': settings['GEMINI_API_KEY'] || settings.geminiApiKey || '',
    'MODEL_ID': settings['MODEL_ID'] || settings.geminiModelId || 'gemini-2.5-flash',
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
  return saveDocuments([doc]);
}

function saveDocuments(docs) {
  if (!docs) return getDocuments();
  const docsList = Array.isArray(docs) ? docs : [docs];
  if (docsList.length === 0) return getDocuments();

  const db = new SheetORM(DOCUMENTS_SHEET, { autoCreate: true });
  var allRecords = db.all();
  var nextSNo = allRecords.length + 1;

  const toInsert = [];
  docsList.forEach(function(doc, idx) {
    var record = {
      'S No': doc.sNo || String(nextSNo + idx),
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
      toInsert.push(record);
    }
  });

  if (toInsert.length > 0) {
    db.insertMany(toInsert);
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

function generateLetterWithAI(payload) {
  const settings = getCompanySettings();
  const apiKey = (payload && payload.apiKey) || settings.geminiApiKey || '';
  const modelId = (payload && payload.modelId) || settings.geminiModelId || 'gemini-2.5-flash';

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Please set it in Settings.');
  }

  const promptText = (payload && payload.prompt) || '';
  const wordLimit = (payload && payload.wordLimit) || 150;
  const companyInfo = (payload && payload.companyInfo) || '';
  const consigneeInfo = (payload && payload.consigneeInfo) || '';

  const systemInstruction = "You are a professional corporate letter writer. Draft an official letter based on the prompt.\n" +
    "Rules:\n" +
    "1. Maximum length: " + wordLimit + " words.\n" +
    "2. Return ONLY a valid JSON object with keys 'title' and 'content'.\n" +
    "   'title': Document Title string\n" +
    "   'content': HTML body content string using standard tags like <p>, <br>, <strong>, etc.\n" +
    "3. Do not output code fences or extra plain text.";

  const userMessage = "User Request: " + promptText + "\n" +
    (companyInfo ? "Company Details: " + companyInfo + "\n" : "") +
    (consigneeInfo ? "Consignee / Signatory Details: " + consigneeInfo + "\n" : "");

  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(modelId) + ":generateContent?key=" + encodeURIComponent(apiKey);

  const requestBody = {
    contents: [
      {
        parts: [
          { text: systemInstruction + "\n\n" + userMessage }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json"
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseText = response.getContentText();

  if (response.getResponseCode() !== 200) {
    throw new Error("Gemini API Error (" + response.getResponseCode() + "): " + responseText);
  }

  try {
    const json = JSON.parse(responseText);
    const rawOutput = (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0] && json.candidates[0].content.parts[0].text) || "";

    let parsedResult = { title: "Generated Letter", content: rawOutput };
    try {
      const cleanText = rawOutput.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      parsedResult = JSON.parse(cleanText);
    } catch (e) {
      parsedResult = { title: "AI Generated Document", content: rawOutput };
    }
    return parsedResult;
  } catch (err) {
    throw new Error("Failed to parse response from Gemini API: " + err.message);
  }
}