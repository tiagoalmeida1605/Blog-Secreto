/**
 * ==========================================================================
 * ImageService - Upload, compressão, validação e remoção de imagens
 * ==========================================================================
 * Integração com Firebase Storage para gerenciamento de imagens de projetos.
 * Suporte a PNG, JPG, JPEG, WEBP. Limite de 10MB.
 * Redimensionamento automático para 1600px e conversão para WebP no navegador.
 * ==========================================================================
 */

import { storage } from "../../../firebase/firebase.js";
import {
    ref,
    uploadBytesResumable,
    deleteObject,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const MIME_TYPES_PERMITIDOS = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp"
];

const EXTENSOES_PERMITIDAS = [
    "png",
    "jpg",
    "jpeg",
    "webp"
];

const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB
const LARGURA_MAXIMA = 1600;
const QUALIDADE_WEBP = 0.85;

export const ImageService = {

    /**
     * Valida se o arquivo é permitido (MIME, extensão e tamanho).
     * Retorna { valido: boolean, erro: string|null }
     */
    validarArquivo(file) {
        if (!file) {
            return { valido: false, erro: "Nenhum arquivo selecionado." };
        }

        const mime = (file.type || "").toLowerCase();
        if (!MIME_TYPES_PERMITIDOS.includes(mime)) {
            return {
                valido: false,
                erro: `Formato não permitido: "${mime}". Use apenas PNG, JPG, JPEG ou WEBP.`
            };
        }

        const nome = (file.name || "").toLowerCase();
        const ext = nome.split(".").pop();
        if (!EXTENSOES_PERMITIDAS.includes(ext)) {
            return {
                valido: false,
                erro: `Extensão ".${ext}" não permitida. Use apenas .png, .jpg, .jpeg ou .webp.`
            };
        }

        if (file.size > TAMANHO_MAXIMO) {
            const mb = (file.size / (1024 * 1024)).toFixed(1);
            return {
                valido: false,
                erro: `Arquivo muito grande (${mb} MB). O limite é de 10 MB.`
            };
        }

        return { valido: true, erro: null };
    },

    /**
     * Redimensiona e converte a imagem para WebP no navegador.
     * @param {File} file - Arquivo original
     * @param {number} maxWidth - Largura máxima (padrão: 1600px)
     * @param {number} quality - Qualidade da compressão (0-1)
     * @returns {Promise<Blob>} Blob da imagem otimizada
     */
    async comprimirImagem(file, maxWidth = LARGURA_MAXIMA, quality = QUALIDADE_WEBP) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(url);

                const canvas = document.createElement("canvas");
                let { width, height } = img;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";
                ctx.drawImage(img, 0, 0, width, height);

                const mimeType = "image/webp";
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error("Falha ao comprimir a imagem."));
                            return;
                        }
                        resolve(blob);
                    },
                    mimeType,
                    quality
                );
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Falha ao carregar a imagem para compressão."));
            };

            img.src = url;
        });
    },

    /**
     * Gera o caminho (path) no Firebase Storage para a imagem de um projeto.
     */
    gerarPath(projectId, fileName) {
        const ext = "webp";
        return `projetos/${projectId}/capa.${ext}`;
    },

    /**
     * Faz upload da imagem para o Firebase Storage com monitoramento de progresso.
     * @param {string} projectId - ID do projeto
     * @param {File|Blob} file - Arquivo ou Blob da imagem
     * @param {function} onProgress - Callback de progresso (0-100)
     * @returns {Promise<{ downloadURL: string, path: string, size: number, type: string }>}
     */
    async uploadImagem(projectId, file, onProgress = null) {
        const path = this.gerarPath(projectId, file.name || "capa.webp");
        const storageRef = ref(storage, path);

        const metadata = {
            contentType: "image/webp",
            customMetadata: {
                originalName: file.name || "capa.webp",
                uploadedAt: new Date().toISOString(),
                projectId
            }
        };

        return new Promise((resolve, reject) => {
            const uploadTask = uploadBytesResumable(storageRef, file, metadata);

            uploadTask.on(
                "state_changed",
                (snapshot) => {
                    if (onProgress && snapshot.totalBytes > 0) {
                        const progress = Math.round(
                            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                        );
                        onProgress(progress);
                    }
                },
                (erro) => {
                    console.error("Erro no upload da imagem:", erro);
                    let mensagem = "Erro ao fazer upload da imagem.";
                    if (erro.code === "storage/unauthorized") {
                        mensagem = "Sem permissão para fazer upload.";
                    } else if (erro.code === "storage/canceled") {
                        mensagem = "Upload cancelado.";
                    } else if (erro.code === "storage/retry-limit-exceeded") {
                        mensagem = "Limite de tentativas excedido. Verifique sua conexão.";
                    }
                    reject(new Error(mensagem));
                },
                async () => {
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve({
                            downloadURL,
                            path,
                            size: file.size,
                            type: "image/webp"
                        });
                    } catch (erro) {
                        reject(new Error("Erro ao obter URL da imagem após upload."));
                    }
                }
            );
        });
    },

    /**
     * Exclui uma imagem do Firebase Storage pelo path.
     * @param {string} path - Caminho completo da imagem no Storage
     * @returns {Promise<boolean>}
     */
    async excluirImagem(path) {
        if (!path) return false;
        try {
            const storageRef = ref(storage, path);
            await deleteObject(storageRef);
            return true;
        } catch (erro) {
            if (erro.code === "storage/object-not-found") {
                console.warn(`Imagem não encontrada no Storage para exclusão: ${path}`);
                return true;
            }
            console.error("Erro ao excluir imagem do Storage:", erro);
            throw new Error("Não foi possível excluir a imagem do Storage.");
        }
    },

    /**
     * Formata o tamanho do arquivo para exibição amigável.
     */
    formatarTamanho(bytes) {
        if (!bytes || bytes <= 0) return "0 B";
        const unidades = ["B", "KB", "MB", "GB"];
        const i = Math.min(
            Math.floor(Math.log(bytes) / Math.log(1024)),
            unidades.length - 1
        );
        const valor = bytes / Math.pow(1024, i);
        return `${i === 0 ? valor : valor.toFixed(1)} ${unidades[i]}`;
    },

    /**
     * Cria um preview da imagem em um elemento <img>.
     * @param {File} file - Arquivo da imagem
     * @param {HTMLImageElement} imgElement - Elemento <img> para exibir o preview
     * @returns {Promise<string>} URL do objeto para revogação posterior
     */
    async criarPreview(file, imgElement) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                imgElement.src = e.target.result;
                imgElement.style.display = "block";
                resolve(e.target.result);
            };

            reader.onerror = () => {
                reject(new Error("Erro ao ler o arquivo para preview."));
            };

            reader.readAsDataURL(file);
        });
    },

    /**
     * Remove o preview (revoga a URL do objeto).
     */
    removerPreview(imgElement) {
        if (imgElement) {
            imgElement.src = "";
            imgElement.style.display = "none";
        }
    }
};

window.ImageService = ImageService;