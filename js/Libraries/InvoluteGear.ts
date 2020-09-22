/** Creates an Involute Spur Gear Face with the Given Radius, Number of Teeth, and Attack Angle;
 * Shamelessly Ripped from https://ciechanow.ski/gears/ */
function SpurGear(radius, num_teeth, attack_angle) {
    let gear = CacheOp(arguments, () => {
        function involute_points(radius, angle, num, left) {
            let points = [];
            for (let i = 0; i <= num; i++) {
                let a = angle * i/num;
                let l = Math.abs(a * radius);
                let p0 = [-radius * Math.sin(a), 
                           radius * Math.cos(a)];
                let p1L = Math.sqrt((p0[0]*p0[0]) + (p0[1]*p0[1])); let p1 = [p0[0]/p1L, p0[1]/p1L];
                p1 = [p0[0] + (p1[1] * l), p0[1] - (p1[0] * l)];
                if (left) { p1[0] *= -1; }
                points.push(p1);
            }
            return points;
        }
        function drawInvoluteProfile(sketch, points, ang, base_angle, forward){
            let cba = Math.cos(ang + (forward?1:-1)*base_angle);
            let sba = Math.sin(ang + (forward?1:-1)*base_angle);
            let involuteCurve = [];
            for (let j = (forward?0:points.length-1); forward?(j<points.length):(j>=0); j+=(forward?1:-1)) {
                let curPoint =[cba*points[j][0] + sba*points[j][1],
                              -sba*points[j][0] + cba*points[j][1]];
                if(j === (forward?0:points.length - 1)){ sketch.LineTo(curPoint); }
                involuteCurve.push(curPoint);
            }
            sketch.BSplineTo(involuteCurve);
        }
        if(!attack_angle) { attack_angle = 20; }
        let n_stop              = num_teeth;
        let angle               = attack_angle * Math.PI/180;
        let d                   = 2*radius;
        let p                   = num_teeth/d;
        let a                   = 1/p;
        let b                   = 1.25/p;
        let rb                  = radius * Math.cos(angle);
        let r_add               = radius + a;
        let r_ded               = radius - b;
        let inv_limit           = Math.sqrt(r_add*r_add - rb*rb)/rb;
        let pitch_point_to_base = Math.sin(angle)*radius;
        let base_angle          = pitch_point_to_base/rb + Math.PI*0.5/num_teeth -angle;
        let ded_limit_angle     = r_ded < rb ? (Math.PI  / num_teeth - base_angle) : 0;
        let pr = involute_points(rb, inv_limit, 10, false);
        let pl = involute_points(rb, inv_limit, 10, true );
        let ang    = 0;
        let sketch = null;
        for (let i = 0; i < n_stop; i++){
            let a0 = -ang + -Math.PI/num_teeth +ded_limit_angle + Math.PI/2;
            let startPt = [(r_ded - 2)*Math.cos(a0), (r_ded - 2)*Math.sin(a0)];
            if(sketch){
                sketch.LineTo(startPt)
            }else{
                sketch = new Sketch(startPt);
            }

            drawInvoluteProfile(sketch, pr, ang, base_angle, true );
            drawInvoluteProfile(sketch, pl, ang, base_angle, false);

            a0 = Math.PI/num_teeth - ded_limit_angle + Math.PI/2 - ang;
            sketch.LineTo ([(r_ded - 2)*Math.cos(a0),
                            (r_ded - 2)*Math.sin(a0)]);
            ang -= 2*Math.PI/num_teeth;
        }
        let gearFace = sketch.End(true).Face();
        sceneShapes = Remove(sceneShapes, gearFace);
        return gearFace;
    });
    sceneShapes.push(gear);
    return gear;
}
