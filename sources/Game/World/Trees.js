import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Foliage } from './Foliage.js'
import { color, uniform } from 'three/tsl'

export class Trees
{
    constructor(name, visual, references, colorA, colorB)
    {
        this.game = Game.getInstance()

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: `🌳 ${name}`,
                expanded: false,
            })
        }

        this.visual = visual
        this.references = references
        this.colorA = colorA
        this.colorB = colorB

        this.setModelParts()
        this.setBodies()
        this.setLeaves()
        this.setPhysical()
    }

    setModelParts()
    {
        this.modelParts = {}
        this.modelParts.leaves = []
        this.modelParts.body = null
        
        this.visual.traverse((_child) =>
        {
            if(_child.isMesh)
            {
                if(_child.name.startsWith('treeLeaves'))
                    this.modelParts.leaves.push(_child)
                else if(_child.name.startsWith('treeBody'))
                    this.modelParts.body = _child
            }
        })
    }

    setBodies()
    {
        this.game.materials.updateObject(this.modelParts.body)
        this.bodies = new THREE.InstancedMesh(this.modelParts.body.geometry, this.modelParts.body.material, this.references.length)
        this.bodies.instanceMatrix.setUsage(THREE.StaticDrawUsage)
        this.bodies.castShadow = true
        this.bodies.receiveShadow = true
        
        let i = 0
        for(const treeReference of this.references)
        {
            this.bodies.setMatrixAt(i, treeReference.matrix)
            i++
        }

        this.game.scene.add(this.bodies)
    }

    setLeaves()
    {
        const references = []
        
        for(const treeReference of this.references)
        {
            for(const leaves of this.modelParts.leaves)
            {
                const finalMatrix = leaves.matrix.clone().premultiply(treeReference.matrixWorld)
                const reference = new THREE.Object3D()
                reference.applyMatrix4(finalMatrix)

                references.push(reference)
            }
        }

        const leavesColorANode = uniform(color(this.colorA))
        const leavesColorBNode = uniform(color(this.colorB))
        this.leaves = new Foliage(references, leavesColorANode, leavesColorBNode, true)
        this.leavesColorA = leavesColorANode
        this.leavesColorB = leavesColorBNode

        // Debug
        if(this.game.debug.active)
        {
            this.game.debug.addThreeColorBinding(this.debugPanel, leavesColorANode.value, 'leavesColorA')
            this.game.debug.addThreeColorBinding(this.debugPanel, leavesColorBNode.value, 'leavesColorB')
            this.debugPanel.addBinding(this.leaves.material.shadowOffset, 'value', { label: 'shadowOffset', min: 0, max: 2, step: 0.001 })
            this.debugPanel.addBinding(this.leaves.material.threshold, 'value', { label: 'threshold', min: 0, max: 1, step: 0.001 })
            this.debugPanel.addBinding(this.leaves.material.seeThroughEdgeMin, 'value', { label: 'seeThroughEdgeMin', min: 0, max: 1, step: 0.001 })
            this.debugPanel.addBinding(this.leaves.material.seeThroughEdgeMax, 'value', { label: 'seeThroughEdgeMax', min: 0, max: 1, step: 0.001 })
        }
    }

    setPhysical()
    {
        // Trees are light dynamic bodies: the car can knock them over (they sleep until hit)
        this.trees = []
        this.leavesPerTree = this.modelParts.leaves.length
        const inverse = new THREE.Matrix4()
        const leafWorld = new THREE.Vector3()
        let i = 0
        for(const treeReference of this.references)
        {
            treeReference.updateMatrix()
            inverse.copy(treeReference.matrix).invert()
            // leaf cluster centers in the tree's local space (to follow the trunk when it falls)
            const leaves = []
            for(let l = 0; l < this.leavesPerTree; l++)
            {
                const index = i * this.leavesPerTree + l
                leafWorld.fromArray(this.leaves.instanceMatrix.array, index * 16 + 12)
                leaves.push(leafWorld.clone().applyMatrix4(inverse))
            }

            const tree = { lastHit: 0 }
            const object = this.game.objects.add(
                null,
                {
                    type: 'dynamic',
                    position: treeReference.position.clone().add(new THREE.Vector3(0, 2.5, 0)),
                    rotation: treeReference.quaternion,
                    friction: 0.7,
                    mass: 0.6,
                    sleeping: true,
                    contactThreshold: 10,
                    colliders: [ { shape: 'cylinder', parameters: [ 2.5, 0.25 ], category: 'object' } ],
                    onCollision: (force, position) =>
                    {
                        // only real hits, at most a few times per second per tree
                        const now = this.game.ticker.elapsed
                        if(force < 2 || now - (tree.lastHit || 0) < 0.4)
                            return
                        tree.lastHit = now
                        this.game.audio.groups.get('hitDefault').playRandomNext(force, position)
                    }
                }
            )
            tree.object = object
            Object.assign(tree, { scale: treeReference.scale.clone(), leaves })
            this.trees.push(tree)
            i++
        }

        this.leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        this.bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

        const matrix = new THREE.Matrix4()
        const offset = new THREE.Matrix4().makeTranslation(0, - 2.5, 0)
        const scale = new THREE.Matrix4()
        const position = new THREE.Vector3()
        const quaternion = new THREE.Quaternion()
        this.game.ticker.events.on('tick', () =>
        {
            let bodiesChanged = false
            let leavesChanged = false
            this.trees.forEach((tree, t) =>
            {
                const body = tree.object.physical.body
                if(body.isSleeping())
                    return
                const p = body.translation()
                const q = body.rotation()
                position.set(p.x, p.y, p.z)
                quaternion.set(q.x, q.y, q.z, q.w)
                matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1)).multiply(offset).multiply(scale.makeScale(tree.scale.x, tree.scale.y, tree.scale.z))
                this.bodies.setMatrixAt(t, matrix)
                bodiesChanged = true
                tree.leaves.forEach((local, l) =>
                {
                    leafWorld.copy(local).applyMatrix4(matrix)
                    leafWorld.toArray(this.leaves.instanceMatrix.array, (t * this.leavesPerTree + l) * 16 + 12)
                })
                leavesChanged = true
            })
            if(bodiesChanged)
                this.bodies.instanceMatrix.needsUpdate = true
            if(leavesChanged)
                this.leaves.instanceMatrix.needsUpdate = true
        }, 10)
    }
}
