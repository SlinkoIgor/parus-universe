"""A line-of-sight / inclined-plane intersection; no random depths or shells."""
import math
PC=3.2615637771674336
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def unit(ra,dec):
 a,b=math.radians(ra),math.radians(dec)
 return [math.cos(b)*math.cos(a),math.cos(b)*math.sin(a),math.sin(b)]
def basis(ra,dec,pa):
 a,b,p=map(math.radians,[ra,dec,pa]);u=unit(ra,dec);e=[-math.sin(a),math.cos(a),0];n=[-math.sin(b)*math.cos(a),-math.sin(b)*math.sin(a),math.cos(b)]
 major=[math.sin(p)*x+math.cos(p)*y for x,y in zip(e,n)]
 northwest=[-math.cos(p)*x+math.sin(p)*y for x,y in zip(e,n)]
 return u,major,northwest
def intersection(ra,dec,ra0,dec0,d,inclination,pa,sign=1):
 u,major,q=basis(ra0,dec0,pa);v=unit(ra,dec);i=math.radians(inclination)
 normal=[math.cos(i)*x+sign*math.sin(i)*y for x,y in zip(u,q)]
 den=dot(normal,v)
 if den<=.05:return None
 distance=d*math.cos(i)/den;point=[distance*x for x in v];delta=[x-d*y for x,y in zip(point,u)]
 minor=[math.cos(i)*x-sign*math.sin(i)*y for x,y in zip(q,u)]
 return {'distance':distance,'point':point,'major':dot(delta,major),'minor':dot(delta,minor),'radius':math.hypot(*delta),'normal':normal,'delta':delta}
def locate(member,host,model,policy):
 ra,dec=member['raDeg'],member['decDeg'];ra0,dec0,d=host['raDeg'],host['decDeg'],host['d'];i,pa=model['inclinationDeg'],model['positionAngleDeg'];limit=model['maxRadiusPc']*PC
 nominal=intersection(ra,dec,ra0,dec0,d,i,pa)
 if not nominal:return None
 if member['placement']=='host-envelope':
  v=unit(ra,dec);point=[d*x for x in v];radius=math.hypot(*[x-d*y for x,y in zip(point,unit(ra0,dec0))]);envelope=limit
  result={**nominal,'point':point,'distance':d,'radius':radius,'mode':'host-envelope'}
 else:
  result={**nominal,'mode':'host-disk'};envelope=model['halfThicknessPc']*PC/max(.05,math.cos(math.radians(i)))
  angle=policy['angularSensitivityDeg']
  for di,dp in [(angle,0),(-angle,0),(0,angle),(0,-angle)]:
   alt=intersection(ra,dec,ra0,dec0,d,i+di,pa+dp)
   if alt:envelope=max(envelope,abs(alt['distance']-nominal['distance']))
  if not model['nearSideKnown']:
   alt=intersection(ra,dec,ra0,dec0,d,i,pa,-1)
   if alt:envelope=max(envelope,abs(alt['distance']-nominal['distance']))
 result.update(localEnvelopeLy=envelope,referenceScaleLy=2*limit,accepted=(member['placement']!='host-envelope' or policy.get('allowUnresolvedHostDepthOnMap',False)) and result['radius']<=limit and envelope/(2*limit)<=policy['hostMaxLocalEnvelopeFraction'])
 return result
