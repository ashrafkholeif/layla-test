// CSV template for menu items

export function handleGetMenuTemplate(req, res) {
  try {
    const csvContent = `اسم العنصر,السعر,الوصف
برجر,50,برجر لذيذ مع الخضار
بيتزا,60,بيتزا إيطالية طازة
دجاج مشوي,45,دجاج مشوي بالتوابل
كنتاكي,40,دجاج كنتاكي مقرمش
فلافل,25,فلافل محمصة طازة
كبة,35,كبة لحم مقلية
شاورما,50,شاورما لحم مع الخضار
كفتة,30,كفتة لحم مشوية
`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=menu-template.csv",
    );
    res.status(200).send("\ufeff" + csvContent); // BOM for UTF-8 encoding
  } catch (err) {
    console.error("❌ Error generating template:", err.message);
    return res.status(500).json({
      error: "Failed to generate template",
    });
  }
}

export function csvToJson(csvText) {
  const lines = csvText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error("CSV must contain at least a header row and one data row");
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

  // Find column indices
  const nameIdx = headers.findIndex(
    (h) => h.includes("name") || h.includes("اسم"),
  );
  const priceIdx = headers.findIndex(
    (h) => h.includes("price") || h.includes("السعر") || h.includes("سعر"),
  );
  const descIdx = headers.findIndex(
    (h) => h.includes("desc") || h.includes("وصف"),
  );

  if (nameIdx === -1 || priceIdx === -1) {
    throw new Error(
      "CSV must contain 'name' (or 'اسم') and 'price' (or 'السعر') columns",
    );
  }

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());

    if (values.length > nameIdx && values[nameIdx]) {
      const name = values[nameIdx];
      const price = parseFloat(values[priceIdx]);
      const description = descIdx !== -1 ? values[descIdx] : null;

      if (!isNaN(price) && price > 0) {
        items.push({
          name,
          price,
          ...(description && { description }),
        });
      }
    }
  }

  if (items.length === 0) {
    throw new Error("No valid items found in CSV");
  }

  return items;
}
