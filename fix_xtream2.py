path = '/home/cloud-server/lib/xtream.js'
c = open(path).read()
c = c.replace("http://proxpanel.cc:80", "http://ex2025.cc")
c = c.replace("http://proxpanel.fans:8080", "http://ex2025.cc")
c = c.replace("'8691274970'", "'ledyxpro24'")
c = c.replace("'5595837537'", "'2943689'")
open(path,'w').write(c)
print('OK')
print(open(path).read()[:200])
