import { interval, fromEvent, from, zip, timer, Subscription } from 'rxjs'
import { map, scan, filter, merge, flatMap, take, concat, takeUntil} from 'rxjs/operators'

function pong() {
    // Inside this function you will use the classes and functions 
    // from rx.js
    // to add visuals to the svg element in pong.html, animate them, and make them interactive.
    // Study and complete the tasks in observable exampels first to get ideas.
    // Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/ 
    // You will be marked on your functional programming style
    // as well as the functionality that you implement.
    // Document your code!  
    type State = Readonly<{
      paddle_1:Body
      paddle_2:Body
      ball:Body
      score_1:number
      score_2:number
      gameOver:boolean
    }>
    type Body = Readonly<{
      id:string
      pos:Vec
      vel:Vec
      reverseX:boolean
      reverseY:boolean
    }>

    type Key = 'ArrowUp' | 'ArrowDown'
    type Event = 'keydown' | 'keyup'

    // Vector class for all the math so our functions stay pure
    class Vec {
      constructor(public readonly x: number = 0, public readonly y: number = 0) {}

      add = (b:Vec) => new Vec(this.x + b.x, this.y + b.y)
      sub = (b:Vec) => this.add(b.scale(-1))
      len = ()=> Math.sqrt(this.x*this.x + this.y*this.y)
      scale = (s:number) => new Vec(this.x*s,this.y*s)
      static Zero = new Vec();
    }

    // returns a random number in range [-1,1]
    const nextRandom = ()=>Math.random()*2 - 1 

    // returns a initial paddle_1 body state
    function createPaddle_1():Body {
      return {
        id:'paddle_1',
        pos:new Vec(0,0),
        vel:Vec.Zero,
        reverseX:false,
        reverseY:false
      }
    }

    // returns a initial paddle_2 body state
    function createPaddle_2():Body {
      return {
        id:'paddle_2',
        pos:new Vec(0,0),
        vel:new Vec(0,4),
        reverseX:false,
        reverseY:false
      }
    }

    // returns a initial ball body state
    function createBall():Body {
      return nextRandom()>0?{
        id:'ball',
        pos:new Vec(0,Math.floor(150*nextRandom())),
        vel:Vec.Zero,
        reverseX:true,
        reverseY:false
      } :
      {
        id:'ball',
        pos:new Vec(0,Math.floor(150*nextRandom())),
        vel:Vec.Zero,
        reverseX:true,
        reverseY:true
      }
    }

    // Create an initial state for pong
    const initialState: State = {
      paddle_1:createPaddle_1(),
      paddle_2:createPaddle_2(),
      ball:createBall(),
      score_1:0,
      score_2:0,
      gameOver:false
    }

    // checks if item when moved up or down is in canvas
    const inCanvasY = (o: Vec, e:Move):boolean => ((o.add(new Vec(0,e.units)).y<=290)&&
        (o.sub(new Vec(0,e.units)).y>=-290))?true:false
    
    // checks if item when moved left or right is in canvas
    const inCanvasX = (o: Vec, e:Move):boolean => ((o.add(new Vec(e.units,0)).x<500)&&
        (o.sub(new Vec(e.units,0)).x>-500))?true:false

    /// a function to move objects
    function moveObj(o:Body):Body {
      if(o.id === 'ball'){ 
        let x = 0,
            y = 0;
        o.reverseX ? x = -(4+o.vel.x): x = 4+o.vel.x
        o.reverseY ? y = -(4+o.vel.y): y = 4+o.vel.y
        return {...o,
            pos:o.pos.add(new Vec(x,y)),
          }
      }
      else if(o.id === 'paddle_1'){return inCanvasY(o.pos,new Move(10))||
        (o.pos.y==-290&&o.vel.y==10)||
        (o.pos.y==290&&o.vel.y==-10)?
        {...o,
          pos:o.pos.add(o.vel)
        } :
        {...o,
          pos:o.pos.sub(o.vel)
        }
      }
      else {
        return {...o}
      }
    }

    // a function for the computer to adjust the paddle based on ball location
    const computerMove = (p:Body, b:Body): Body => 
      inCanvasY(p.pos, new Move(p.vel.y))? 
        b.pos.y > p.pos.y? 
            {...p, pos:p.pos.add(p.vel)}
            : {...p, pos:p.pos.sub(p.vel)}
        : p.pos.y>0?
          {...p,pos:p.pos.sub(p.vel)}
          : {...p,pos:p.pos.add(p.vel)}

    // a function that modifies the velocity of the ball depending on where the ball strikes
    const modVel = (b:Body, p:Body): Body =>
        currBallPos(b).y-currPaddlePos(p).y>-10&&currBallPos(b).y-currPaddlePos(p).y<15? // 0 => -10
        {...b,vel: b.vel.add(new Vec(0,2))} :
        currBallPos(b).y-currPaddlePos(p).y>=15&&currBallPos(b).y-currPaddlePos(p).y<30?
        {...b,vel: b.vel.add(new Vec(0,1))} :
        currBallPos(b).y-currPaddlePos(p).y>=30&&currBallPos(b).y-currPaddlePos(p).y<45?
        {...b,vel: b.vel.add(new Vec(0,0))} :
        currBallPos(b).y-currPaddlePos(p).y>=45&&currBallPos(b).y-currPaddlePos(p).y<60?
        {...b,vel: b.vel.add(new Vec(0,-1))} :
        currBallPos(b).y-currPaddlePos(p).y>=60&&currBallPos(b).y-currPaddlePos(p).y<75?
        {...b,vel: b.vel.add(new Vec(0,-2))} : null
    
    // a function that calculates the current position of ball/paddle in canvas
    const currBallPos = (b:Body) => new Vec(500+b.pos.x,300+b.pos.y);
    const currPaddlePos = (p:Body) => p.id == 'paddle_1'? new Vec(25+p.pos.x,250+p.pos.y):new Vec(950+p.pos.x,250+p.pos.y);
    // checks if the y coordinates of the ball is in range of y coordinates of the paddle
    const ballInRangeOfPaddle = (a:Body, b:Body)=>currBallPos(b).y-currPaddlePos(a).y>-10&&currBallPos(b).y-currPaddlePos(a).y<75 // 0 => -1

    // a tick function that runs every 10ms that changes the state of the game
    function tick(s:State):State {
      const
        // checks if paddle has collided with the ball
        bodiesCollided = (a:Body,b:Body)=>a.id=='paddle_1'?(currBallPos(b).x==currPaddlePos(a).x+15)&&ballInRangeOfPaddle(a,b)
          : (currBallPos(b).x==currPaddlePos(a).x-10)&&ballInRangeOfPaddle(a,b),
        // check if ball is in the x coordinates of the paddle
        ballInCollisionZone = (b:Body) => b.pos.x==-460 || b.pos.x==440,
        // returns true if paddle colides with ball
        paddleCollided = (p:Body) => ballInCollisionZone(s.ball)? bodiesCollided(p,s.ball):false;

      return (s.score_1==7 || s.score_2==7)?{...s,gameOver:true}
      : !inCanvasX(s.ball.pos, new Move(s.ball.vel.x))? s.ball.pos.x>0?
        {...s,
          score_1:s.score_1+1,
          paddle_1: moveObj(s.paddle_1),
          paddle_2: computerMove(s.paddle_2,s.ball),
          ball: createBall()
        } :
        {...s,
          score_2:s.score_2+1,
          paddle_1: moveObj(s.paddle_1),
          paddle_2: computerMove(s.paddle_2,s.ball),
          ball: createBall()
        }
      : (paddleCollided(s.paddle_1)||(paddleCollided(s.paddle_2)))? (paddleCollided(s.paddle_1))?
        {...s,
          paddle_1:moveObj(s.paddle_1),
          paddle_2: computerMove(s.paddle_2,s.ball),
          ball: moveObj(modVel(reverseBallX(s.ball),s.paddle_1))
        } :
        {...s,
            paddle_1:moveObj(s.paddle_1),
            paddle_2: computerMove(s.paddle_2,s.ball),
            ball: moveObj(modVel(reverseBallX(s.ball),s.paddle_2))
        }
      : inCanvasY(s.ball.pos, new Move(s.ball.vel.y))? 
        {...s,
          paddle_1: moveObj(s.paddle_1),
          paddle_2: computerMove(s.paddle_2,s.ball),
          ball: moveObj(s.ball)
        } :
        {...s,
          paddle_1: moveObj(s.paddle_1),
          paddle_2: computerMove(s.paddle_2,s.ball),
          ball: moveObj(reverseBallY(s.ball)),
        }
      
    }

    const reverseBallX = (o:Body) =><Body> {...o,reverseX: !(o.reverseX),}
    const reverseBallY = (o:Body) =><Body> {...o,reverseY: !(o.reverseY),}

    class Tick { constructor(public readonly elapsed:number) {} }
    class Move { constructor(public readonly units:number) {} }

    // observe keys pressed
    const observeKey = <T>(eventName:Event, k:Key, result:()=>T)=>
      fromEvent<KeyboardEvent>(document,eventName)
        .pipe(
          filter(({code})=>code === k),
          filter(({repeat})=>!repeat),
          map(result)),

    // All observable events
      startMoveUp = observeKey('keydown','ArrowUp',()=>new Move(-10)),
      startMoveDown = observeKey('keydown','ArrowDown',()=>new Move(10)),
      stopMoveUp = observeKey('keyup','ArrowUp',()=>new Move(10)),
      stopMoveDown = observeKey('keyup','ArrowDown',()=>new Move(-10))
    
    // Encapsulate all transformation into a function
    const reduceState = (s:State, e:Move|Tick) => 
      e instanceof Move ? 
        {...s,
          paddle_1: {...s.paddle_1,vel: s.paddle_1.vel.add(new Vec(0,e.units))}
        }:
      tick(s);
      
    // runs scan and subscribe every 10ms
    const subscription = interval(10)
    .pipe(
      map(elapsed=>new Tick(elapsed)),
      merge(
        startMoveUp,startMoveDown,stopMoveUp,stopMoveDown),
      scan(reduceState, initialState))
    .subscribe(updateView);

    // Set the canvas to a const
    const svg = document.getElementById("canvas")!;

    // Create paddle_1 element
    const paddle_1 = document.createElementNS(svg.namespaceURI,'rect')
    Object.entries({
      x: 25, y: 250,
      width: 15, height: 75,
      fill: '#95B3D7',
    }).forEach(([key,val])=>paddle_1.setAttribute(key,String(val)))
    svg.appendChild(paddle_1);

    // Create paddle_2 element
    const paddle_2 = document.createElementNS(svg.namespaceURI,'rect')
    Object.entries({
      x: 950, y: 250,
      width: 15, height: 75,
      fill: '#95B3D7',
    }).forEach(([key,val])=>paddle_2.setAttribute(key,String(val)))
    svg.appendChild(paddle_2);

    // Create ball element
    const ball = document.createElementNS(svg.namespaceURI,'rect')
    Object.entries({
      x:500, y: 300,
      width: 10, height: 10,
      fill: '#95B3D7',
    }).forEach(([key,val])=>ball.setAttribute(key,String(val)))
    svg.appendChild(ball);

    // Create score_1 element
    const score_1 = document.createElementNS(svg.namespaceURI, "text")!;
    Object.entries({
      x:250,y:50,
      'font-size':32,
      fill:'#FFFFFF', class:"score_1",
    }).forEach(([key,val])=>score_1.setAttribute(key,String(val)))
    svg.appendChild(score_1);

    // Create score_2 element
    const score_2 = document.createElementNS(svg.namespaceURI, "text")!;
    Object.entries({
      x:750,y:50,
      'font-size':32,
      fill:'#FFFFFF', class:"score_2",
    }).forEach(([key,val])=>score_2.setAttribute(key,String(val)))
    svg.appendChild(score_2)
    
    // Create line element
    const line = document.createElementNS(svg.namespaceURI, "line")!;
    Object.entries({
      x1:500,x2:500,
      y1:0,y2:600,
      'stroke':'white',
      class:"line",
    }).forEach(([key,val])=>line.setAttribute(key,String(val)))
    svg.appendChild(line);

    // a function that constantly changes the display based on the change in state of the game
    function updateView(s: State) {
      paddle_1.setAttribute('transform', `translate(${s.paddle_1.pos.x},${s.paddle_1.pos.y})`);
      paddle_2.setAttribute('transform', `translate(${s.paddle_2.pos.x},${s.paddle_2.pos.y})`);
      ball.setAttribute('transform', `translate(${s.ball.pos.x},${s.ball.pos.y})`);
      score_1.textContent = `${s.score_1}`;
      score_2.textContent = `${s.score_2}`;

      // When the game is over, unsubscribe and print the ending screen
      if(s.gameOver){
        subscription.unsubscribe()
        const v = document.createElementNS(svg.namespaceURI, "text")!;
        Object.entries({
          x:svg.clientWidth/6,y:svg.clientHeight/2,
          'font-size':120,
          fill:'#FD3A2D', class:"gameover",
        }).forEach(([key,val])=>v.setAttribute(key,String(val)))
        v.textContent = "Game Over";
        svg.appendChild(v);

        const winner = document.createElementNS(svg.namespaceURI, "text")!;
        Object.entries({
          x:2*svg.clientWidth/5,y:2*svg.clientHeight/3,
          'font-size':48,
          fill:'#FFFFFF', class:"winner",
        }).forEach(([key,val])=>winner.setAttribute(key,String(val)))

        const retryMessage = document.createElementNS(svg.namespaceURI, "text")!;
        Object.entries({
          x:svg.clientWidth/3,y:4*svg.clientHeight/5,
          'font-size':48,
          fill:'#FFFFFF', class:"retryMessage",
        }).forEach(([key,val])=>retryMessage.setAttribute(key,String(val)))
        retryMessage.textContent = "Press R to retry"

        s.score_1>s.score_2 ? winner.textContent = "You Win!":winner.textContent = "CPU Wins!"
        svg.appendChild(winner);
        svg.appendChild(retryMessage);
        
        // reads a retry function when r is pressed
        fromEvent<KeyboardEvent>(document, "keydown").
          pipe(map(({keyCode}) => ({key:keyCode}))).
            pipe(filter(({key}) => key == 82)).subscribe(()=>restart())
        
        function restart():void {
          svg.removeChild(paddle_1)
          svg.removeChild(paddle_2)
          svg.removeChild(ball)
          svg.removeChild(score_1)
          svg.removeChild(score_2)
          svg.removeChild(v)
          svg.removeChild(winner)
          svg.removeChild(retryMessage)
          pong()
        }
        
      }

    }

  }

  // the following simply runs your pong function on window load.  Make sure to leave it in place.
  if (typeof window != 'undefined')
    window.onload = ()=>{
      pong();
    }