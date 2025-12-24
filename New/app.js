const SUPABASE_URL = "https://alypaotbkavedfarzyco.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFseXBhb3Ria2F2ZWRmYXJ6eWNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNjM2MzgsImV4cCI6MjA4MTgzOTYzOH0.cw6-7vSK2nd4AFVIyfJdLNBuv7TZWJkq10dzLyKuFhc";

const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const loginPage = document.body.classList.contains("login-page");
const ensureAppMessage = () => {
  if (loginPage) return null;
  let message = document.getElementById("appMessage");
  if (message) return message;
  message = document.createElement("div");
  message.id = "appMessage";
  message.className = "app-message";
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  message.hidden = true;
  document.body.prepend(message);
  return message;
};

const appMessage = ensureAppMessage();
const setAppMessage = (text, tone = "error") => {
  if (!appMessage) return;
  appMessage.textContent = text;
  appMessage.dataset.tone = tone;
  appMessage.hidden = !text;
};

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const setLoginMessage = (text, tone = "error") => {
  if (!loginMessage) return;
  loginMessage.textContent = text;
  loginMessage.dataset.tone = tone;
  loginMessage.hidden = !text;
};

if (loginForm) {
  if (!supabaseClient) {
    setLoginMessage("Supabase failed to load. Check your internet connection.");
  }
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabaseClient) return;
    const formData = new FormData(loginForm);
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");
    if (!username || !password) {
      setLoginMessage("Enter username and password.");
      return;
    }
    const email = username.includes("@")
      ? username
      : `${username}@theeventfactory.local`;
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setLoginMessage(error.message);
      return;
    }
    window.location.href = "dashboard.html";
  });
}

if (!loginPage && supabaseClient) {
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("[Auth] Session error", error);
      window.location.href = "index.html";
      return;
    }
    if (!data.session) {
      window.location.href = "index.html";
    }
  });
}

if (!loginPage && !supabaseClient) {
  setAppMessage("Supabase failed to load. Check your internet connection.", "error");
}

const statusLabels = {
  Active: "active",
  "In progress": "progress",
  "Under review": "review",
  Inactive: "inactive",
};

const setupStatusSelect = (select) => {
  const updateStatus = () => {
    const value = select.value;
    select.dataset.status = statusLabels[value] || "";
  };

  select.addEventListener("change", updateStatus);
  updateStatus();
};

document.querySelectorAll(".status-select").forEach((select) => {
  setupStatusSelect(select);
});

const createStatusCell = () => {
  const td = document.createElement("td");
  const select = document.createElement("select");
  select.className = "status-select";
  select.innerHTML = `
    <option value="" selected>Select status</option>
    <option>Active</option>
    <option>In progress</option>
    <option>Under review</option>
    <option>Inactive</option>
  `;
  td.appendChild(select);
  setupStatusSelect(select);
  return td;
};

const addRowButtons = document.querySelectorAll(".add-row");
addRowButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const tableKey = button.dataset.table;
    const table = document.querySelector(`table[data-table="${tableKey}"]`);
    if (!table) return;
    if (!supabaseClient) {
      setAppMessage("Supabase failed to load. Cannot add rows.", "error");
      return;
    }
    const tbody = table.querySelector("tbody");
    const columns = table.dataset.columns.split(",");
    const record = {};
    columns.forEach((column) => {
      record[column] = "";
    });
    const { data, error } = await supabaseClient
      .from(tableKey)
      .insert([record])
      .select()
      .single();
    if (error) {
      setAppMessage(`Add row failed (${tableKey}): ${error.message}`, "error");
      return;
    }
    const row = buildTableRow(columns, data, tableKey);
    tbody.appendChild(row);
    setAppMessage("", "success");
  });
});

const buildTableRow = (columns, data, tableName) => {
  const row = document.createElement("tr");
  row.dataset.id = data.id;
  columns.forEach((column) => {
    if (column === "status") {
      const td = createStatusCell();
      const select = td.querySelector("select");
      select.value = data[column] || "";
      setupStatusSelect(select);
      select.addEventListener("change", () => {
        updateCell(tableName, data.id, column, select.value);
      });
      row.appendChild(td);
    } else {
      const td = document.createElement("td");
      td.contentEditable = "true";
      td.textContent = data[column] || "";
      td.addEventListener("blur", () => {
        updateCell(tableName, data.id, column, td.textContent.trim());
      });
      row.appendChild(td);
    }
  });
  return row;
};

const updateCell = async (tableName, rowId, column, value) => {
  if (!supabaseClient) return;
  const { error } = await supabaseClient
    .from(tableName)
    .update({ [column]: value })
    .eq("id", rowId);
  if (error) {
    setAppMessage(`Update failed (${tableName}): ${error.message}`, "error");
  } else {
    setAppMessage("", "success");
  }
};

const insertBlankRow = async (tableName, columns) => {
  if (!supabaseClient) return null;
  const record = {};
  columns.forEach((column) => {
    record[column] = "";
  });
  const { data, error } = await supabaseClient
    .from(tableName)
    .insert([record])
    .select()
    .single();
  if (error) {
    setAppMessage(`Insert failed (${tableName}): ${error.message}`, "error");
    return null;
  }
  return data;
};

const loadTables = async () => {
  if (!supabaseClient) return;
  const tables = document.querySelectorAll("table[data-table]");
  for (const table of tables) {
    const tableName = table.dataset.table;
    const columns = table.dataset.columns.split(",");
    const tbody = table.querySelector("tbody");
    if (!tbody) continue;
    const { data, error } = await supabaseClient.from(tableName).select("*").order("created_at");
    if (error) {
      setAppMessage(`Load failed (${tableName}): ${error.message}`, "error");
      continue;
    }
    tbody.innerHTML = "";
    if (!data || data.length === 0) {
      const blank = await insertBlankRow(tableName, columns);
      if (blank) {
        tbody.appendChild(buildTableRow(columns, blank, tableName));
      }
      continue;
    }
    data.forEach((row) => {
      tbody.appendChild(buildTableRow(columns, row, tableName));
    });
  }
};

const invoiceFileInput = document.getElementById("invoiceFile");
const invoiceSubmit = document.getElementById("invoiceSubmit");
const invoiceCancel = document.getElementById("invoiceCancel");
const invoiceItems = document.getElementById("invoiceItems");

const updateUploadLabel = (file) => {
  const label = document.querySelector(".upload-btn");
  if (!label) return;
  label.lastChild.textContent = file ? file.name : "Upload file";
};

const renderInvoices = async () => {
  if (!invoiceItems || !supabaseClient) return;
  const { data, error } = await supabaseClient.from("invoices").select("*").order("created_at");
  if (error) {
    setAppMessage(`Load failed (invoices): ${error.message}`, "error");
    return;
  }
  invoiceItems.innerHTML = "";
  data.forEach((item) => {
    const card = document.createElement("div");
    card.className = "invoice-item";

    const preview = document.createElement("div");
    preview.className = "invoice-preview";
    if (item.file_type && item.file_type.startsWith("image/") && item.public_url) {
      const img = document.createElement("img");
      img.src = item.public_url;
      img.alt = item.name;
      preview.appendChild(img);
    } else {
      preview.textContent = "PDF";
    }

    const meta = document.createElement("div");
    meta.className = "invoice-meta";
    const name = document.createElement("strong");
    name.textContent = item.name || "Untitled file";
    const details = document.createElement("span");
    details.textContent = item.size_kb ? `${item.size_kb} KB` : "";
    meta.appendChild(name);
    meta.appendChild(details);

    const openLink = document.createElement("a");
    openLink.className = "invoice-open";
    openLink.href = item.public_url || "#";
    openLink.target = "_blank";
    openLink.rel = "noopener";
    openLink.textContent = "Open";
    if (!item.public_url) {
      openLink.setAttribute("aria-disabled", "true");
      openLink.style.opacity = "0.6";
      openLink.style.pointerEvents = "none";
    }

    card.appendChild(preview);
    card.appendChild(meta);
    card.appendChild(openLink);
    invoiceItems.appendChild(card);
  });
};

const clearTableButtons = document.querySelectorAll("[data-clear-table]");
clearTableButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const tableName = button.dataset.clearTable;
    if (!tableName) return;
    if (!supabaseClient) {
      window.alert("Supabase failed to load. Clear not available.");
      return;
    }
    const confirmed = window.confirm(`Clear all data in ${tableName}?`);
    if (!confirmed) return;
    const { error } = await supabaseClient
      .from(tableName)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      window.alert(`Clear failed: ${error.message}`);
      return;
    }
    if (tableName === "invoices") {
      await renderInvoices();
    } else {
      await loadTables();
    }
  });
});

const uploadInvoice = async (file) => {
  if (!supabaseClient) return;
  const bucket = "invoices";
  const fileName = `${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabaseClient.storage
    .from(bucket)
    .upload(fileName, file);
  if (uploadError) {
    setAppMessage(`Upload failed: ${uploadError.message}`, "error");
    return;
  }
  const publicUrl = supabaseClient.storage.from(bucket).getPublicUrl(fileName).data.publicUrl;
  const { error: insertError } = await supabaseClient.from("invoices").insert([
    {
      name: file.name,
      file_type: file.type,
      public_url: publicUrl,
      size_kb: (file.size / 1024).toFixed(1),
    },
  ]);
  if (insertError) {
    setAppMessage(`Save failed (invoices): ${insertError.message}`, "error");
    return;
  }
  await renderInvoices();
};

if (invoiceFileInput && invoiceSubmit && invoiceCancel) {
  invoiceFileInput.addEventListener("change", () => {
    updateUploadLabel(invoiceFileInput.files[0]);
  });

  invoiceCancel.addEventListener("click", () => {
    invoiceFileInput.value = "";
    updateUploadLabel(null);
  });

  invoiceSubmit.addEventListener("click", async () => {
    const file = invoiceFileInput.files[0];
    if (!file) return;
    await uploadInvoice(file);
    invoiceFileInput.value = "";
    updateUploadLabel(null);
  });
}

loadTables();
renderInvoices();

const financeRoot = document.querySelector(".finance-simple");
if (financeRoot) {
  const financeMessage = document.getElementById("financeMessage");
  const localStorageKey = "finance-data";
  let useLocalStore = false;
  const setFinanceMessage = (text, tone = "error") => {
    if (!financeMessage) return;
    financeMessage.textContent = text;
    financeMessage.dataset.tone = tone;
    financeMessage.hidden = !text;
  };

  const handleFinanceError = (context, error) => {
    const message = error?.message ? `${context}: ${error.message}` : `${context}: Unknown error`;
    console.error(`[Money Manager] ${context}`, error);
    setFinanceMessage(message, "error");
  };

  if (!supabaseClient) {
    useLocalStore = true;
    setFinanceMessage("Supabase failed to load. Using local storage.", "error");
  }

  const incomeForm = document.getElementById("incomeForm");
  const expenseForm = document.getElementById("expenseForm");
  const incomeTable = document.getElementById("incomeTable");
  const expenseTable = document.getElementById("expenseTable");
  const summaryIncome = document.getElementById("summaryIncome");
  const summaryExpense = document.getElementById("summaryExpense");
  const summaryBalance = document.getElementById("summaryBalance");
  const financeReset = document.getElementById("financeReset");
  let refreshTimer = null;

  const readLocalStore = () => {
    const fallback = { incomes: [], expenses: [] };
    if (!window.localStorage) return fallback;
    try {
      const raw = window.localStorage.getItem(localStorageKey);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return {
        incomes: Array.isArray(parsed.incomes) ? parsed.incomes : [],
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      };
    } catch (error) {
      console.error("[Money Manager] Local store read failed", error);
      return fallback;
    }
  };

  const writeLocalStore = (data) => {
    if (!window.localStorage) return;
    try {
      window.localStorage.setItem(localStorageKey, JSON.stringify(data));
    } catch (error) {
      console.error("[Money Manager] Local store write failed", error);
    }
  };

  const ensureLocalId = () => `local-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const queueRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshAll().catch((error) => handleFinanceError("Refresh failed", error));
    }, 400);
  };

  const updateRow = async (tableName, id, payload) => {
    if (useLocalStore) {
      const current = readLocalStore();
      const list = tableName === "incomes" ? current.incomes : current.expenses;
      const nextList = list.map((item) => (item.id === id ? { ...item, ...payload } : item));
      if (tableName === "incomes") {
        current.incomes = nextList;
      } else {
        current.expenses = nextList;
      }
      writeLocalStore(current);
      queueRefresh();
      return;
    }
    const { error } = await supabaseClient.from(tableName).update(payload).eq("id", id);
    if (error) {
      useLocalStore = true;
      handleFinanceError("Update failed, switching to local storage", error);
      queueRefresh();
      return;
    }
    queueRefresh();
  };

  const renderIncome = (items) => {
    if (!incomeTable) return;
    const tbody = incomeTable.querySelector("tbody");
    tbody.innerHTML = "";
    items.forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td contenteditable="true">${item.date || ""}</td>
        <td contenteditable="true">${item.amount || ""}</td>
        <td contenteditable="true">${item.source || ""}</td>
        <td contenteditable="true">${item.note || ""}</td>
      `;
      const fields = ["date", "amount", "source", "note"];
      Array.from(row.children).forEach((cell, index) => {
        cell.addEventListener("blur", () => {
          updateRow("incomes", item.id, { [fields[index]]: cell.textContent.trim() });
        });
      });
      tbody.appendChild(row);
    });
  };

  const renderExpenses = (items) => {
    if (!expenseTable) return;
    const tbody = expenseTable.querySelector("tbody");
    tbody.innerHTML = "";
    items.forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td contenteditable="true">${item.date || ""}</td>
        <td contenteditable="true">${item.amount || ""}</td>
        <td contenteditable="true">${item.destination || ""}</td>
        <td contenteditable="true">${item.note || ""}</td>
      `;
      const fields = ["date", "amount", "destination", "note"];
      Array.from(row.children).forEach((cell, index) => {
        cell.addEventListener("blur", () => {
          updateRow("expenses", item.id, { [fields[index]]: cell.textContent.trim() });
        });
      });
      tbody.appendChild(row);
    });
  };

  const renderSummary = (incomeItems, expenseItems) => {
    const totalIncome = incomeItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalExpense = expenseItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const balance = totalIncome - totalExpense;
    if (summaryIncome) summaryIncome.textContent = totalIncome.toFixed(2);
    if (summaryExpense) summaryExpense.textContent = totalExpense.toFixed(2);
    if (summaryBalance) summaryBalance.textContent = balance.toFixed(2);
  };

  const refreshAll = async () => {
    if (useLocalStore) {
      const localData = readLocalStore();
      renderIncome(localData.incomes);
      renderExpenses(localData.expenses);
      renderSummary(localData.incomes, localData.expenses);
      setFinanceMessage("Using local storage (not synced).", "success");
      return;
    }
    const [incomeResult, expenseResult] = await Promise.all([
      supabaseClient.from("incomes").select("*").order("date"),
      supabaseClient.from("expenses").select("*").order("date"),
    ]);
    if (incomeResult.error || expenseResult.error) {
      useLocalStore = true;
      handleFinanceError("Load failed, switching to local storage", incomeResult.error || expenseResult.error);
      await refreshAll();
      return;
    }
    const incomes = incomeResult.data || [];
    const expenses = expenseResult.data || [];
    renderIncome(incomes);
    renderExpenses(expenses);
    renderSummary(incomes, expenses);
    setFinanceMessage("", "success");
  };

  if (incomeForm) {
    incomeForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(incomeForm).entries());
      if (useLocalStore) {
        const current = readLocalStore();
        current.incomes.unshift({ id: ensureLocalId(), ...payload });
        writeLocalStore(current);
        incomeForm.reset();
        await refreshAll();
        return;
      }
      const { error } = await supabaseClient.from("incomes").insert([payload]);
      if (error) {
        useLocalStore = true;
        handleFinanceError("Income save failed, switching to local storage", error);
        const current = readLocalStore();
        current.incomes.unshift({ id: ensureLocalId(), ...payload });
        writeLocalStore(current);
      }
      incomeForm.reset();
      await refreshAll();
    });
  }

  if (expenseForm) {
    expenseForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(expenseForm).entries());
      if (useLocalStore) {
        const current = readLocalStore();
        current.expenses.unshift({ id: ensureLocalId(), ...payload });
        writeLocalStore(current);
        expenseForm.reset();
        await refreshAll();
        return;
      }
      const { error } = await supabaseClient.from("expenses").insert([payload]);
      if (error) {
        useLocalStore = true;
        handleFinanceError("Expense save failed, switching to local storage", error);
        const current = readLocalStore();
        current.expenses.unshift({ id: ensureLocalId(), ...payload });
        writeLocalStore(current);
      }
      expenseForm.reset();
      await refreshAll();
    });
  }

  if (financeReset) {
    financeReset.addEventListener("click", async () => {
      const confirmed = window.confirm("Clear all income and expense data?");
      if (!confirmed) return;
      const emptyData = { incomes: [], expenses: [] };
      writeLocalStore(emptyData);
      if (!useLocalStore) {
        const [incomeDelete, expenseDelete] = await Promise.all([
          supabaseClient.from("incomes").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
          supabaseClient.from("expenses").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        ]);
        if (incomeDelete.error || expenseDelete.error) {
          useLocalStore = true;
          handleFinanceError(
            "Clear failed, local storage cleared only",
            incomeDelete.error || expenseDelete.error
          );
        }
      }
      await refreshAll();
    });
  }

  if (window.location.search.includes("reset=1")) {
    const emptyData = { incomes: [], expenses: [] };
    writeLocalStore(emptyData);
    if (!useLocalStore) {
      Promise.all([
        supabaseClient.from("incomes").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabaseClient.from("expenses").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      ]).then(([incomeDelete, expenseDelete]) => {
        if (incomeDelete.error || expenseDelete.error) {
          useLocalStore = true;
          handleFinanceError(
            "Clear failed, local storage cleared only",
            incomeDelete.error || expenseDelete.error
          );
        } else {
          setFinanceMessage("All data cleared.", "success");
        }
      });
    } else {
      setFinanceMessage("All data cleared.", "success");
    }
  }

  refreshAll().catch((error) => handleFinanceError("Load failed", error));
}
