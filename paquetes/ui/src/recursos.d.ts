// Las imágenes que importa un componente: Vite las sirve y el import da su dirección.
declare module "*.png" {
  const url: string;
  export default url;
}
