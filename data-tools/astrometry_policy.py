"""Only attach a formal error to the distance derived from that same solution."""
def match_hyg(distance_pc,hip,hip2007,hip1997,tolerance_pc=.00006):
    for source,table in [('I/311 HIP2007',hip2007),('I/239 HIP1997',hip1997)]:
        value=table.get(hip)
        if not value or value[0]<=0 or value[1]<0:continue
        # HYG stores distances rounded to four decimal pc. This is a matching
        # tolerance, never an uncertainty or permission to borrow an old sigma.
        if abs(distance_pc-1000/value[0])<=tolerance_pc:
            return {'astrometrySource':source,'parallaxMas':value[0],'parallaxErrorMas':value[1],'distanceRelativeError':value[1]/value[0],'uncertaintyMatched':True}
    return {'astrometrySource':'HYG adopted distance; formal uncertainty unavailable','distanceRelativeError':None,'uncertaintyMatched':False}
