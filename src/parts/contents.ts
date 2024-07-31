import { Bodies, Body, Composite, Composites, Constraint, Engine, Events, Render, Runner } from "matter-js";
import { Conf } from "../core/conf";
import { Func } from "../core/func";
import { MyDisplay } from "../core/myDisplay";
import { Tween } from "../core/tween";
import { Item } from "./item";
import { Rect } from "../libs/rect";
import { MousePoint } from "../core/mouse";
import { Util } from "../libs/util";
import { Point } from "../libs/point";

// -----------------------------------------
//
// -----------------------------------------
export class Contents extends MyDisplay {

  private _engine:Engine;
  private _render:Render;
  private _mouse:Body;
  private _stack:Composite;
  private _stackSize:Rect = new Rect(0,0,200,40);

  // 外枠
  // private _frame:Array<Body> = [];

  private _isHover: boolean = false
  private _items: Array<Item> = []
  private _isStart: boolean = false

  constructor(opt:any) {
    super(opt)

    Tween.set(this.el, {
      width: this._stackSize.width + 'px',
      height: this._stackSize.height + 'px',
    })

    const num = 10
    for(let i = 0; i < num; i++) {
      // 複製する
      const org = document.querySelector('.l-accordion.js-org') as HTMLElement
      const el = org.cloneNode(true) as HTMLElement
      this.el.appendChild(el)
      el.classList.remove('js-org')

      const item = new Item({
        el: el,
        id: i,
      })
      this._items.push(item)

      Tween.set(el, {
        zIndex: num - i,
      })
    }

    if(Conf.IS_TOUCH_DEVICE) {
      this._items[0].el.addEventListener('touchstart', () => {
        if(this._isHover) {
          this._eRollOut()
        } else {
          this._eRollOver()
        }

      })
    } else {
      this._setHover(this._items[0].el)
    }


    const sw = Func.sw();
    const sh = Func.sh();

    // エンジン
    this._engine = Engine.create();

    // レンダラー
    this._render = Render.create({
      element: document.body,
      engine: this._engine,
      options: {
        width: sw,
        height: sh,
        showAngleIndicator: true,
        showCollisions: true,
        showVelocity: true,
        pixelRatio:Conf.FLG_SHOW_MATTERJS ? 1 : 0.1,
      }
    });
    this._render.canvas.classList.add('js-matter')
    if(!Conf.FLG_SHOW_MATTERJS) {
      this._render.canvas.classList.add('-hide')
    }

    let group = Body.nextGroup(true);

    const startPos = new Point(sw * 0.5 - this._stackSize.width * 0.5, 100)

    this._stack = Composites.stack(startPos.x, startPos.y, this._items.length, 1, 0, 0, (x:any, y:any) => {
      return Bodies.rectangle(x, y, this._stackSize.width, this._stackSize.height, {
        collisionFilter: { group: group },
        render:{visible: Conf.FLG_SHOW_MATTERJS}
      });
    });

    Composites.chain(this._stack, 0.5, 0, -0.5, 0, { stiffness: 0.8, length: 0, render: { type: 'line' } });
    Composite.add(this._stack, Constraint.create({
        bodyB: this._stack.bodies[0],
        pointB: { x: 0, y: 0 },
        pointA: { x: this._stack.bodies[0].position.x, y: this._stack.bodies[0].position.y },
        stiffness: 0.8,
    }));

    this._stack.bodies[0].isStatic = true
    // this._stack.bodies[1].isStatic = true

    this._stack.bodies.forEach((val,i) => {
      if(i > 0) {
        val.isStatic = true
        Body.setPosition(val, {x:startPos.x + this._stackSize.width * 0.5, y:startPos.y + this._stackSize.height * 0.5})
        Body.setAngle(val, Util.radian(180 * i))
      }
    })

    Composite.add(this._engine.world, [
      this._stack,
    ]);

    // マウス
    const mouseSize =  Math.max(sw, sh) * 0.05
    this._mouse = Bodies.circle(0, 0, mouseSize, {isStatic:true, render:{visible: Conf.FLG_SHOW_MATTERJS}});
    Composite.add(this._engine.world, [
      this._mouse,
    ]);


    // run the renderer
    Render.run(this._render);

    // create runner
    const runner:Runner = Runner.create();

    // run the engine
    Runner.run(runner, this._engine);

    // 描画後イベント
    Events.on(this._render, 'afterRender', () => {
      this._eAfterRender();
    })

    this._resize();
  }

  private _start(): void {
    this._stack.bodies.forEach((val,i) => {
      if(i > 0) {
        val.isStatic = false
      }
    })

    document.querySelector(".js-matter")?.classList.add('-hover')
    this._c = 0
  }

  private _eAfterRender(): void {
    // 物理演算結果をパーツに反映
    this._stack.bodies.forEach((val,i) => {
      const item = this._items[i];
      const pos = val.position
      Tween.set(item.el, {
        x:pos.x - this._stackSize.width * 0.5,
        y:pos.y - this._stackSize.height * 0.5,
        rotationZ:Util.degree(val.angle),
      })
    })
  }

  //
  protected _eRollOver() {
    this._isHover = true


    if(!this._isStart) {
      this._isStart = true
      this._start()
      this._items[0].addClass('-open')
    }
  }

  //
  protected _eRollOut() {
    this._isHover = false
    // this._items[0].removeClass('-open')
  }

  protected _update():void {
    super._update()

    let mx = MousePoint.instance.x
    let my = MousePoint.instance.y

    if(Conf.USE_TOUCH && MousePoint.instance.isDown == false) {
      mx = 9999
      my = 9999
    }

    // マウス位置に合わせる
    if(this._isStart && this._c > 100) Body.setPosition(this._mouse, {x:mx, y:my});
  }

  protected _resize(): void {
    super._resize();

    const sw = Func.sw();
    const sh = Func.sh();

    this._render.canvas.width = sw;
    this._render.canvas.height = sh;

    // this._makeFrame();
  }

  // private _makeFrame(): void {
  //   // 一旦破棄
  //   if(this._frame.length > 0) {
  //     Composite.remove(this._engine.world, this._frame[0])
  //     Composite.remove(this._engine.world, this._frame[1])
  //     Composite.remove(this._engine.world, this._frame[2])
  //     Composite.remove(this._engine.world, this._frame[3])
  //     this._frame = [];
  //   }

  //   const sw = Func.sw();
  //   const sh = Func.sh();

  //   // 外枠
  //   const width = 1
  //   this._frame[0] = Bodies.rectangle(0, -width * 0, 9999, width, {isStatic:true});
  //   this._frame[1] = Bodies.rectangle(sw + width * 0 + 9999, 0, width, 9999, {isStatic:true}); // 最初引っかかるので今回はどけておく
  //   this._frame[2] = Bodies.rectangle(sw, sh + width * 0, 9999, width, {isStatic:true});
  //   this._frame[3] = Bodies.rectangle(-width * 0, 0, width, 9999, {isStatic:true});

  //   Composite.add(this._engine.world, [
  //     this._frame[0],
  //     this._frame[1],
  //     this._frame[2],
  //     this._frame[3],
  //   ])
  // }
}