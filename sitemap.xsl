<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <meta name="robots" content="noindex"/>
        <title>Sitemap · St. Mary’s College of Education, Chengalpattu</title>
        <style>
          body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#FFFDF9;color:#2B1A1D}
          header{background:#7B1C2A;color:#fff;padding:28px 20px}
          header h1{margin:0;font-size:1.5rem}
          header p{margin:6px 0 0;color:#E9C9C6;font-size:.95rem}
          main{max-width:1100px;margin:0 auto;padding:24px 20px 48px}
          .card{background:#fff;border:1px solid #EBDFD5;border-radius:12px;padding:20px;margin-bottom:20px}
          .card h2{margin:0 0 10px;font-size:1.1rem;color:#7B1C2A}
          a{color:#7B1C2A;overflow-wrap:anywhere}
          dl{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;margin:0;font-size:.95rem}
          dt{color:#6F5C5F}
          .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
          .grid a{display:block}
          .grid img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;background:#F8F0E7;display:block}
          .note{font-size:.85rem;color:#6F5C5F}
        </style>
      </head>
      <body>
        <header>
          <h1>XML Sitemap</h1>
          <p>St. Mary’s College of Education and Research Institute, Chengalpattu. This file tells search engines which pages and photos to index.</p>
        </header>
        <main>
          <xsl:for-each select="s:urlset/s:url">
            <div class="card">
              <h2>Page</h2>
              <dl>
                <dt>Address</dt><dd><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></dd>
                <dt>Last updated</dt><dd><xsl:value-of select="s:lastmod"/></dd>
                <dt>Photos listed</dt><dd><xsl:value-of select="count(image:image)"/></dd>
              </dl>
            </div>
            <div class="card">
              <h2>Photos (<xsl:value-of select="count(image:image)"/>)</h2>
              <div class="grid">
                <xsl:for-each select="image:image">
                  <a href="{image:loc}" target="_blank" rel="noopener"><img src="{image:loc}" alt="" loading="lazy"/></a>
                </xsl:for-each>
              </div>
            </div>
          </xsl:for-each>
          <p class="note">Search engines read the raw XML behind this page; the styling is only for people viewing it in a browser.</p>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
