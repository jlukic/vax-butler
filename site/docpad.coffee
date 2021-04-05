# DocPad Configuration File
# http://docpad.org/docs/config

# Define the DocPad Configuration
docpadConfig = {

  srcPath : './input'
  outPath : './output'

  # env: 'production'
  regenerateDelay: 1,

  port: 9778,


  ## SET TEMPLATE DATA
  templateData:

    site:

      # The production url of our website
      url: "https://www.vaxbutler.nyc"

      # Update this flag whenever css/js should be reloaded
      version: "1.0.5",

      # version of code
      updatedDate: '4/5/2021'
      packageVersion: "1.0.1",


      # The default title of our website
      title: "Welcome | Vaccine Butler"

      # The website description (for SEO)
      description: """Vaccine butler helps users book vaccine appointments"""

      # The website keywords (for SEO) separated by commas
      keywords: """nyc, vaccine, scheduler, helper, butler"""



    getTitle: ->

      # if we have a document title, then we should use that and suffix the site's title onto it
      if @document.title
        "#{@document.title} | Vaccine Butler"

      # if our document does not have it's own title, then we should just use the site's title
      else
        @site.title


    getH1: ->
      # if we have a document h1, then we should use that and suffix the site's h1 onto it
      if @document.h1
        "#{@document.h1}"
      if @document.title
        "#{@document.h1}"
      # if our document does not have it's own h1, then we should just use the site's h1
      else
        @site.h1

    getVersion: ->
      @site.version

    isActive: (word, secondWord) =>
      'active' if word == secondWord

    tokenize: (name) =>
      slug = String(name).toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/&/g, '-and-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '')
      ;
      return slug;

    encodeURI: (value) =>
      encodeURIComponent(value)

    getCurrentYear: ->
      new Date().getFullYear()

    getDescription: ->
      # if we have a document description, then we should use that, otherwise use the site's description
      @document.description or @site.description

    # Get the prepared site/document keywords
    getKeywords: ->
      # Merge the document keywords with the site keywords
      @site.keywords.concat(@document.keywords or []).join(', ')

  plugins:

    ghpages:
      deployRemote: 'origin'
      deployBranch: 'gh-pages'

    sitemap:
      cachetime: 600000
      changefreq: 'weekly'
      priority: 0.5
      filePath: 'sitemap.xml'

    cleanurls:
      static: true
      getRedirectTemplate:(url, title) ->
          """
          <!DOCTYPE html>
          <html>
            <head>
              <title>#{title or 'Redirect'}</title>
              <meta http-equiv="REFRESH" content="0; url=#{url}/">
              <link rel="canonical" href="#{url}/" />
            </head>
            <body>
            </body>
          </html>
          """
    copy:
      raw:
        src: 'files'

}

# Export the DocPad Configuration
module.exports = docpadConfig
