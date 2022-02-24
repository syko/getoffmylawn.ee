import Head from 'next/head'
import React, { RefObject } from 'react'
import styles from '../styles/Index.module.css'
import TheInteractiveThing from '../components/the-interactive-thing';

const IMAGE_URL = '/lawn.png';

class Index extends React.Component<{}, { imageLoaded: boolean }> {
  canvas: RefObject<HTMLCanvasElement>;
  imageData!: ImageData;

  constructor(props: {}) {
    super(props);
    this.canvas = React.createRef();
    this.state = { imageLoaded: false };
  }

  componentDidMount() {
    const img = new Image();
    const canvas = this.canvas.current!;
    const ctx = canvas.getContext("2d")!;
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      this.imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      this.setState({ imageLoaded: true });
    }
    img.src = IMAGE_URL;
  }

  render() {
    return (
      <main>
        <Head>
          <title>Get Off My Lawn Entertainment - Next-gen AAA Game Studio</title>
          <meta name="description" content="Next-gen AAA Game Studio" />
          <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no"></meta>
        </Head>
        <h1 className={styles.title}>Get Off My Lawn Entertainment</h1>
        <canvas ref={this.canvas} width="948" height="300" className={styles.inputCanvas}></canvas>
        {this.state.imageLoaded && <TheInteractiveThing imageData={this.imageData} />}
      </main>
    )
  }
}

export default Index
